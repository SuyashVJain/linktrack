package main

import (
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
	ID        int64     `json:"id"`
	Slug      string    `json:"slug"`
	TargetURL string    `json:"target_url"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"created_at"`
	Clicks    int64     `json:"clicks"`
}

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
	const q = `INSERT INTO links(user_id, slug, target_url, label) VALUES($1,$2,$3,$4) RETURNING id, created_at`
	for attempt := 0; attempt < 5; attempt++ {
		slug := in.Slug
		if !custom {
			slug = generateSlug(6)
		}
		out := linkOut{Slug: slug, TargetURL: in.TargetURL, Label: in.Label}
		err := s.db.QueryRow(r.Context(), q, userID(r), slug, in.TargetURL, in.Label).Scan(&out.ID, &out.CreatedAt)
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
		SELECT l.id, l.slug, l.target_url, l.label, l.created_at, count(c.id)
		FROM links l LEFT JOIN clicks c ON c.link_id = l.id
		WHERE l.user_id = $1 GROUP BY l.id ORDER BY l.created_at DESC, l.id DESC`, userID(r))
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	out := []linkOut{}
	for rows.Next() {
		var l linkOut
		if err := rows.Scan(&l.ID, &l.Slug, &l.TargetURL, &l.Label, &l.CreatedAt, &l.Clicks); err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
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
	tag, err := s.db.Exec(r.Context(), `DELETE FROM links WHERE id=$1 AND user_id=$2`, id, userID(r))
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

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	id, ok := linkID(r)
	if !ok {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	ctx := r.Context()
	var owner int64
	if err := s.db.QueryRow(ctx, `SELECT user_id FROM links WHERE id=$1`, id).Scan(&owner); errors.Is(err, pgx.ErrNoRows) || (err == nil && owner != userID(r)) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	} else if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}

	type day struct {
		Day    string `json:"day"`
		Clicks int64  `json:"clicks"`
	}
	type ref struct {
		Referrer string `json:"referrer"`
		Clicks   int64  `json:"clicks"`
	}
	resp := struct {
		Total        int64 `json:"total_clicks"`
		PerDay       []day `json:"clicks_per_day"`
		TopReferrers []ref `json:"top_referrers"`
	}{PerDay: []day{}, TopReferrers: []ref{}}

	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM clicks WHERE link_id=$1`, id).Scan(&resp.Total); err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	// generate_series fills days with no clicks so the chart always has 30 points.
	rows, err := s.db.Query(ctx, `
		SELECT to_char(d::date, 'YYYY-MM-DD'), count(c.id)
		FROM generate_series(current_date - 29, current_date, interval '1 day') d
		LEFT JOIN clicks c ON c.link_id = $1 AND c.clicked_at::date = d::date
		GROUP BY d ORDER BY d`, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	for rows.Next() {
		var d day
		if err := rows.Scan(&d.Day, &d.Clicks); err != nil {
			rows.Close()
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		resp.PerDay = append(resp.PerDay, d)
	}
	rows.Close()

	rows, err = s.db.Query(ctx, `
		SELECT COALESCE(NULLIF(referrer, ''), '(direct)') AS r, count(*) AS n
		FROM clicks WHERE link_id=$1 GROUP BY r ORDER BY n DESC, r LIMIT 10`, id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()
	for rows.Next() {
		var x ref
		if err := rows.Scan(&x.Referrer, &x.Clicks); err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		resp.TopReferrers = append(resp.TopReferrers, x)
	}
	writeJSON(w, http.StatusOK, resp)
}
