package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/time/rate"
)

// newTestServer needs a Postgres reachable at TEST_DATABASE_URL; the public schema is reset per test.
func newTestServer(t *testing.T) *Server {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if _, err := db.Exec(ctx, `DROP SCHEMA public CASCADE; CREATE SCHEMA public`); err != nil {
		t.Fatal(err)
	}
	if err := migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := newServer(db, "test-secret", "")
	s.authLimiter = newIPLimiter(rate.Inf, 1)
	s.redirectLimiter = newIPLimiter(rate.Inf, 1)
	return s
}

func do(t *testing.T, h http.Handler, method, path, token string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func register(t *testing.T, h http.Handler, email string) string {
	t.Helper()
	rec := do(t, h, "POST", "/api/auth/register", "", map[string]string{"email": email, "password": "password123"})
	if rec.Code != http.StatusCreated {
		t.Fatalf("register: %d %s", rec.Code, rec.Body)
	}
	var out struct{ Token string }
	json.NewDecoder(rec.Body).Decode(&out)
	return out.Token
}

func TestAuth(t *testing.T) {
	s := newTestServer(t)
	h := s.routes()
	register(t, h, "a@example.com")

	tests := []struct {
		name, path string
		body       map[string]string
		want       int
	}{
		{"register duplicate", "/api/auth/register", map[string]string{"email": "a@example.com", "password": "password123"}, 409},
		{"register duplicate case-insensitive", "/api/auth/register", map[string]string{"email": "A@example.com", "password": "password123"}, 409},
		{"register bad email", "/api/auth/register", map[string]string{"email": "nope", "password": "password123"}, 400},
		{"register short password", "/api/auth/register", map[string]string{"email": "b@example.com", "password": "short"}, 400},
		{"login ok", "/api/auth/login", map[string]string{"email": "a@example.com", "password": "password123"}, 200},
		{"login wrong password", "/api/auth/login", map[string]string{"email": "a@example.com", "password": "wrongpass1"}, 401},
		{"login unknown user", "/api/auth/login", map[string]string{"email": "z@example.com", "password": "password123"}, 401},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if rec := do(t, h, "POST", tc.path, "", tc.body); rec.Code != tc.want {
				t.Fatalf("got %d, want %d: %s", rec.Code, tc.want, rec.Body)
			}
		})
	}

	t.Run("protected route", func(t *testing.T) {
		for name, tok := range map[string]string{"no token": "", "garbage": "abc.def.ghi", "expired": expiredToken(s)} {
			if rec := do(t, h, "GET", "/api/links", tok, nil); rec.Code != 401 {
				t.Errorf("%s: got %d, want 401", name, rec.Code)
			}
		}
	})
}

func expiredToken(s *Server) string {
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject: "1", ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Hour)),
	}).SignedString(s.secret)
	return tok
}

func TestRateLimit(t *testing.T) {
	s := newTestServer(t)
	s.authLimiter = newIPLimiter(rate.Every(time.Hour), 2)
	h := s.routes()
	var codes []int
	for i := 0; i < 3; i++ {
		codes = append(codes, do(t, h, "POST", "/api/auth/login", "", map[string]string{"email": "x@example.com", "password": "password123"}).Code)
	}
	if codes[0] != 401 || codes[1] != 401 || codes[2] != 429 {
		t.Fatalf("codes = %v, want [401 401 429]", codes)
	}
}

func TestLinks(t *testing.T) {
	s := newTestServer(t)
	h := s.routes()
	tok := register(t, h, "a@example.com")
	other := register(t, h, "b@example.com")

	tests := []struct {
		name string
		body map[string]string
		want int
	}{
		{"random slug", map[string]string{"target_url": "https://example.com"}, 201},
		{"custom slug", map[string]string{"target_url": "https://example.com", "slug": "my-link", "label": "x"}, 201},
		{"duplicate slug", map[string]string{"target_url": "https://example.org", "slug": "my-link"}, 409},
		{"duplicate slug other user", map[string]string{"target_url": "https://example.org", "slug": "my-link"}, 409},
		{"bad url", map[string]string{"target_url": "javascript:alert(1)"}, 400},
		{"missing url", map[string]string{}, 400},
		{"bad slug", map[string]string{"target_url": "https://example.com", "slug": "a b"}, 400},
		{"reserved slug", map[string]string{"target_url": "https://example.com", "slug": "api"}, 400},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if rec := do(t, h, "POST", "/api/links", tok, tc.body); rec.Code != tc.want {
				t.Fatalf("got %d, want %d: %s", rec.Code, tc.want, rec.Body)
			}
		})
	}

	rec := do(t, h, "GET", "/api/links", tok, nil)
	var links []linkOut
	json.NewDecoder(rec.Body).Decode(&links)
	if len(links) != 2 || len(links[1].Slug) != 6 {
		t.Fatalf("list = %+v", links)
	}
	if rec := do(t, h, "GET", "/api/links", other, nil); strings.TrimSpace(rec.Body.String()) != "[]" {
		t.Fatalf("other user sees %s", rec.Body)
	}

	// Ownership: another user can neither read stats nor delete.
	id := fmt.Sprint(links[0].ID)
	if rec := do(t, h, "GET", "/api/links/"+id+"/stats", other, nil); rec.Code != 404 {
		t.Errorf("foreign stats: %d", rec.Code)
	}
	if rec := do(t, h, "DELETE", "/api/links/"+id, other, nil); rec.Code != 404 {
		t.Errorf("foreign delete: %d", rec.Code)
	}
	if rec := do(t, h, "DELETE", "/api/links/"+id, tok, nil); rec.Code != 204 {
		t.Errorf("delete: %d", rec.Code)
	}
	if rec := do(t, h, "GET", "/"+links[0].Slug, "", nil); rec.Code != 404 {
		t.Errorf("deleted slug redirect: %d", rec.Code)
	}
}

func TestRedirectAndClicks(t *testing.T) {
	s := newTestServer(t)
	h := s.routes()
	tok := register(t, h, "a@example.com")
	rec := do(t, h, "POST", "/api/links", tok, map[string]string{"target_url": "https://example.com/dest", "slug": "goto"})
	var link linkOut
	json.NewDecoder(rec.Body).Decode(&link)

	hit := func(slug, ref string) *httptest.ResponseRecorder {
		req := httptest.NewRequest("GET", "/"+slug, nil)
		req.Header.Set("User-Agent", "test-agent")
		if ref != "" {
			req.Header.Set("Referer", ref)
		}
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}

	if rec := hit("missing", ""); rec.Code != 404 {
		t.Fatalf("unknown slug: %d", rec.Code)
	}
	for _, ref := range []string{"https://news.example/a", "https://news.example/a", ""} {
		r := hit("goto", ref)
		if r.Code != 302 || r.Header().Get("Location") != "https://example.com/dest" {
			t.Fatalf("redirect: %d %q", r.Code, r.Header().Get("Location"))
		}
	}
	s.clicks.Wait() // clicks are written asynchronously

	rec = do(t, h, "GET", fmt.Sprintf("/api/links/%d/stats", link.ID), tok, nil)
	var st struct {
		Total  int64 `json:"total_clicks"`
		PerDay []struct {
			Day    string
			Clicks int64
		} `json:"clicks_per_day"`
		Top []struct {
			Referrer string
			Clicks   int64
		} `json:"top_referrers"`
	}
	json.NewDecoder(rec.Body).Decode(&st)
	if st.Total != 3 || len(st.PerDay) != 30 || st.PerDay[29].Clicks != 3 {
		t.Fatalf("stats = %+v", st)
	}
	if len(st.Top) != 2 || st.Top[0].Referrer != "https://news.example/a" || st.Top[0].Clicks != 2 || st.Top[1].Referrer != "(direct)" {
		t.Fatalf("top referrers = %+v", st.Top)
	}

	rec = do(t, h, "GET", "/api/links", tok, nil)
	var links []linkOut
	json.NewDecoder(rec.Body).Decode(&links)
	if links[0].Clicks != 3 {
		t.Fatalf("list clicks = %d", links[0].Clicks)
	}
}

func TestHealthz(t *testing.T) {
	s := newTestServer(t)
	if rec := do(t, s.routes(), "GET", "/healthz", "", nil); rec.Code != 200 {
		t.Fatalf("healthz: %d", rec.Code)
	}
}
