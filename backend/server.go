package main

import (
	"context"
	"errors"
	"net/http"
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
	authLimiter     *ipLimiter
	redirectLimiter *ipLimiter
}

func newServer(db *pgxpool.Pool, secret, staticDir string) *Server {
	return &Server{
		db: db, secret: []byte(secret), staticDir: staticDir,
		authLimiter:     newIPLimiter(rate.Every(6*time.Second), 10), // ~10/min
		redirectLimiter: newIPLimiter(50, 100),
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
		r.Group(func(r chi.Router) {
			r.Use(s.requireAuth)
			r.Post("/links", s.handleCreateLink)
			r.Get("/links", s.handleListLinks)
			r.Delete("/links/{id}", s.handleDeleteLink)
			r.Get("/links/{id}/stats", s.handleStats)
		})
	})

	if s.staticDir != "" {
		r.Handle("/app/*", http.StripPrefix("/app/", http.FileServer(http.Dir(s.staticDir))))
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
