package main

import (
	"context"
	"errors"
	"net/http"
	"net/mail"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

type ctxKey struct{}

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) issueToken(userID int64) (string, error) {
	return jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   strconv.FormatInt(userID, 10),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
	}).SignedString(s.secret)
}

func (s *Server) parseToken(tok string) (int64, error) {
	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(tok, &claims, func(*jwt.Token) (any, error) { return s.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithExpirationRequired())
	if err != nil {
		return 0, err
	}
	return strconv.ParseInt(claims.Subject, 10, 64)
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	addr, err := mail.ParseAddress(c.Email)
	if err != nil || addr.Address != c.Email {
		writeErr(w, http.StatusBadRequest, "invalid email")
		return
	}
	if len(c.Password) < 8 || len(c.Password) > 72 { // bcrypt ignores bytes past 72
		writeErr(w, http.StatusBadRequest, "password must be 8-72 characters")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(c.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	var id int64
	err = s.db.QueryRow(r.Context(),
		`INSERT INTO users(email, password_hash) VALUES($1, $2) RETURNING id`, strings.ToLower(c.Email), string(hash)).Scan(&id)
	if isUniqueViolation(err) {
		writeErr(w, http.StatusConflict, "email already registered")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	s.respondToken(w, http.StatusCreated, id)
}

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	var id int64
	var hash string
	err := s.db.QueryRow(r.Context(), `SELECT id, password_hash FROM users WHERE email=$1`, strings.ToLower(c.Email)).Scan(&id, &hash)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && bcrypt.CompareHashAndPassword([]byte(hash), []byte(c.Password)) != nil) {
		writeErr(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	s.respondToken(w, http.StatusOK, id)
}

func (s *Server) respondToken(w http.ResponseWriter, status int, id int64) {
	tok, err := s.issueToken(id)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, status, map[string]string{"token": tok})
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !ok {
			writeErr(w, http.StatusUnauthorized, "missing token")
			return
		}
		id, err := s.parseToken(tok)
		if err != nil {
			writeErr(w, http.StatusUnauthorized, "invalid token")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, id)))
	})
}

func userID(r *http.Request) int64 { return r.Context().Value(ctxKey{}).(int64) }
