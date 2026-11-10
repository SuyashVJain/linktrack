package main

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func isUniqueViolation(err error) bool {
	var pe *pgconn.PgError
	return errors.As(err, &pe) && pe.Code == "23505"
}

type linkOut struct {
	ID         int64     `json:"id"`
	Slug       string    `json:"slug"`
	ShortURL   string    `json:"short_url"`
	StatsToken string    `json:"stats_token"`
	TargetURL  string    `json:"target_url"`
	Label      string    `json:"label"`
	CreatedAt  time.Time `json:"created_at"`
	Clicks     int64     `json:"clicks"`
}

func (s *Server) shortURL(slug string) string { return s.baseURL + "/" + slug }

// handleCreateLink serves both guests and signed-in users; guests get user_id NULL.
func (s *Server) handleCreateLink(w http.ResponseWriter, r *http.Request) {
	var in struct {
		TargetURL string `json:"target_url"`
		Slug      string `json:"slug"`
		Label     string `json:"label"`
	}
	if !decode(w, r, &in) {
		return
	}
	in.TargetURL = strings.TrimSpace(in.TargetURL)
	if err := validateURL(in.TargetURL); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	if len(in.Label) > 200 {
		writeErr(w, http.StatusBadRequest, "label too long")
		return
	}
	custom := in.Slug != ""
	if custom {
		if err := validateSlug(in.Slug); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
	}
	var owner *int64
	if id, ok := optUserID(r); ok {
		owner = &id
	}
	const q = `INSERT INTO links(user_id, slug, stats_token, target_url, label) VALUES($1,$2,$3,$4,$5) RETURNING id, created_at`
	for attempt := 0; attempt < 5; attempt++ {
		slug := in.Slug
		if !custom {
			slug = generateSlug(6)
		}
		out := linkOut{Slug: slug, ShortURL: s.shortURL(slug), StatsToken: generateSlug(24), TargetURL: in.TargetURL, Label: in.Label}
		err := s.db.QueryRow(r.Context(), q, owner, slug, out.StatsToken, in.TargetURL, in.Label).Scan(&out.ID, &out.CreatedAt)
		if err == nil {
			writeJSON(w, http.StatusCreated, out)
			return
		}
		if !isUniqueViolation(err) {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		if custom {
			writeErr(w, http.StatusConflict, "slug already in use")
			return
		}
	}
	writeErr(w, http.StatusInternalServerError, "could not allocate slug")
}

func (s *Server) handleListLinks(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(r.Context(), `
		SELECT l.id, l.slug, l.stats_token, l.target_url, l.label, l.created_at, count(c.id)
		FROM links l LEFT JOIN clicks c ON c.link_id = l.id
		WHERE l.user_id = $1 GROUP BY l.id ORDER BY l.created_at DESC, l.id DESC`, mustUserID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	out := []linkOut{}
	for rows.Next() {
		var l linkOut
		if err := rows.Scan(&l.ID, &l.Slug, &l.StatsToken, &l.TargetURL, &l.Label, &l.CreatedAt, &l.Clicks); err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		l.ShortURL = s.shortURL(l.Slug)
		out = append(out, l)
	}
	writeJSON(w, http.StatusOK, out)
}

func linkID(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	return id, err == nil
}

func (s *Server) handleDeleteLink(w http.ResponseWriter, r *http.Request) {
	id, ok := linkID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	s.deleteWhere(w, r, `DELETE FROM links WHERE id=$1 AND user_id=$2`, id, mustUserID(r))
}

func (s *Server) handleDeleteByToken(w http.ResponseWriter, r *http.Request) {
	s.deleteWhere(w, r, `DELETE FROM links WHERE stats_token=$1`, chi.URLParam(r, "token"))
}

func (s *Server) deleteWhere(w http.ResponseWriter, r *http.Request, q string, args ...any) {
	tag, err := s.db.Exec(r.Context(), q, args...)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleClaim attaches guest links to the caller. Links that already have an owner are left alone.
func (s *Server) handleClaim(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Tokens []string `json:"tokens"`
	}
	if !decode(w, r, &in) {
		return
	}
	if len(in.Tokens) > 1000 {
		writeErr(w, http.StatusBadRequest, "too many tokens")
		return
	}
	tag, err := s.db.Exec(r.Context(),
		`UPDATE links SET user_id=$1 WHERE stats_token = ANY($2) AND user_id IS NULL`, mustUserID(r), in.Tokens)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int64{"claimed": tag.RowsAffected()})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	id, ok := linkID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	s.writeStats(w, r, `WHERE id=$1 AND user_id=$2`, id, mustUserID(r))
}

func (s *Server) handleStatsByToken(w http.ResponseWriter, r *http.Request) {
	s.writeStats(w, r, `WHERE stats_token=$1`, chi.URLParam(r, "token"))
}

type statsResp struct {
	Link         linkOut `json:"link"`
	Total        int64   `json:"total_clicks"`
	PerDay       []day   `json:"clicks_per_day"`
	TopReferrers []ref   `json:"top_referrers"`
}

type day struct {
	Day    string `json:"day"`
	Clicks int64  `json:"clicks"`
}

type ref struct {
	Referrer string `json:"referrer"`
	Clicks   int64  `json:"clicks"`
}

// writeStats finds one link with the given WHERE clause, then aggregates its clicks in SQL.
func (s *Server) writeStats(w http.ResponseWriter, r *http.Request, where string, args ...any) {
	resp, err := s.loadStats(r.Context(), where, args...)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *Server) loadStats(ctx context.Context, where string, args ...any) (*statsResp, error) {
	resp := &statsResp{PerDay: []day{}, TopReferrers: []ref{}}
	l := &resp.Link
	err := s.db.QueryRow(ctx, `SELECT id, slug, stats_token, target_url, label, created_at FROM links `+where, args...).
		Scan(&l.ID, &l.Slug, &l.StatsToken, &l.TargetURL, &l.Label, &l.CreatedAt)
	if err != nil {
		return nil, err
	}
	l.ShortURL = s.shortURL(l.Slug)

	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM clicks WHERE link_id=$1`, l.ID).Scan(&resp.Total); err != nil {
		return nil, err
	}
	l.Clicks = resp.Total
	// generate_series fills days with no clicks so the chart always has 30 points.
	rows, err := s.db.Query(ctx, `
		SELECT to_char(d::date, 'YYYY-MM-DD'), count(c.id)
		FROM generate_series(current_date - 29, current_date, interval '1 day') d
		LEFT JOIN clicks c ON c.link_id = $1 AND c.clicked_at::date = d::date
		GROUP BY d ORDER BY d`, l.ID)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var d day
		if err := rows.Scan(&d.Day, &d.Clicks); err != nil {
			rows.Close()
			return nil, err
		}
		resp.PerDay = append(resp.PerDay, d)
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		SELECT COALESCE(NULLIF(referrer, ''), '(direct)') AS r, count(*) AS n
		FROM clicks WHERE link_id=$1 GROUP BY r ORDER BY n DESC, r LIMIT 10`, l.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var x ref
		if err := rows.Scan(&x.Referrer, &x.Clicks); err != nil {
			return nil, err
		}
		resp.TopReferrers = append(resp.TopReferrers, x)
	}
	return resp, rows.Err()
}
