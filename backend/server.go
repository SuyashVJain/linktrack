package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
)

type Server struct {
	db     *pgxpool.Pool
	secret []byte
	clicks sync.WaitGroup // in-flight async click writes; drained on shutdown
	// staticDir, when set, serves the built frontend under /app/.
	staticDir       string
	baseURL         string // public origin used to build short_url, no trailing slash
	authLimiter     *ipLimiter
	guestLimiter    *ipLimiter
	redirectLimiter *ipLimiter
}

func newServer(cfg Config, db *pgxpool.Pool) *Server {
	lim := func(l rate.Limit, burst int) *ipLimiter {
		il := newIPLimiter(l, burst)
		il.trustProxy = cfg.TrustProxy
		return il
	}
	return &Server{
		db: db, secret: []byte(cfg.JWTSecret), staticDir: cfg.StaticDir,
		baseURL:         strings.TrimRight(cfg.BaseURL, "/"),
		authLimiter:     lim(rate.Every(6*time.Second), 10), // ~10/min
		guestLimiter:    lim(rate.Every(6*time.Minute), 10), // ~10/hour
		redirectLimiter: lim(50, 100),
	}
}

func (s *Server) routes() http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer, logRequests)

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if err := s.db.Ping(r.Context()); err != nil {
			writeErr(w, http.StatusServiceUnavailable, "database unavailable")
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	r.Route("/api", func(r chi.Router) {
		r.With(s.authLimiter.middleware).Post("/auth/register", s.handleRegister)
		r.With(s.authLimiter.middleware).Post("/auth/login", s.handleLogin)
		r.With(s.guestOrAuth).Post("/links", s.handleCreateLink)
		r.Get("/stats/{token}", s.handleStatsByToken)
		r.Delete("/stats/{token}", s.handleDeleteByToken)
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/links/claim", s.handleClaim)
			r.Get("/links", s.handleListLinks)
			r.Delete("/links/{id}", s.handleDeleteLink)
			r.Get("/links/{id}/stats", s.handleStats)
		})
	})

	if s.staticDir != "" {
		r.Handle("/app/*", s.spa())
		r.Get("/", func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/app/", http.StatusFound) })
	}

	r.With(s.redirectLimiter.middleware).Get("/{slug}", s.handleRedirect)
	return r
}

func (s *Server) handleRedirect(w http.ResponseWriter, r *http.Request) {
	var id int64
	var target string
	err := s.db.QueryRow(r.Context(), `SELECT id, target_url FROM links WHERE slug=$1`, chi.URLParam(r, "slug")).Scan(&id, &target)
	if errors.Is(err, pgx.ErrNoRows) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	ref, ua := truncate(r.Referer(), 2048), truncate(r.UserAgent(), 512)
	s.clicks.Add(1)
	go func() {
		defer s.clicks.Done()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		// country stays NULL: there is no geo lookup.
		s.db.Exec(ctx, `INSERT INTO clicks(link_id, referrer, user_agent) VALUES($1,$2,$3)`, id, ref, ua)
	}()
	http.Redirect(w, r, target, http.StatusFound)
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// spa serves built frontend files and falls back to index.html so client-side routes survive a reload.
func (s *Server) spa() http.Handler {
	files := http.StripPrefix("/app/", http.FileServer(http.Dir(s.staticDir)))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name := filepath.Join(s.staticDir, filepath.FromSlash(strings.TrimPrefix(path.Clean("/"+strings.TrimPrefix(r.URL.Path, "/app/")), "/")))
		if st, err := os.Stat(name); err != nil || st.IsDir() {
			http.ServeFile(w, r, filepath.Join(s.staticDir, "index.html"))
			return
		}
		files.ServeHTTP(w, r)
	})
}
