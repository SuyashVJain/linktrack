package main

import (
	"log"
	"net"
	"net/http"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(s int) { w.status = s; w.ResponseWriter.WriteHeader(s) }

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(sw, r)
		log.Printf("%s %s %d %s", r.Method, r.URL.Path, sw.status, time.Since(start).Round(time.Microsecond))
	})
}

// ipLimiter is a per-IP token bucket. Idle entries are swept so the map stays bounded.
type ipLimiter struct {
	mu    sync.Mutex
	m     map[string]*visitor
	limit rate.Limit
	burst int
}

type visitor struct {
	l    *rate.Limiter
	seen time.Time
}

func newIPLimiter(limit rate.Limit, burst int) *ipLimiter {
	il := &ipLimiter{m: map[string]*visitor{}, limit: limit, burst: burst}
	go func() {
		for range time.Tick(time.Minute) {
			il.mu.Lock()
			for ip, v := range il.m {
				if time.Since(v.seen) > 5*time.Minute {
					delete(il.m, ip)
				}
			}
			il.mu.Unlock()
		}
	}()
	return il
}

func (il *ipLimiter) allow(ip string) bool {
	il.mu.Lock()
	defer il.mu.Unlock()
	v, ok := il.m[ip]
	if !ok {
		v = &visitor{l: rate.NewLimiter(il.limit, il.burst)}
		il.m[ip] = v
	}
	v.seen = time.Now()
	return v.l.Allow()
}

// middleware keys on the TCP peer address.
// shortcut: behind a reverse proxy every client shares the proxy IP, so honour X-Forwarded-For from a trusted proxy before deploying that way.
func (il *ipLimiter) middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip, _, err := net.SplitHostPort(r.RemoteAddr)
		if err != nil {
			ip = r.RemoteAddr
		}
		if !il.allow(ip) {
			writeErr(w, http.StatusTooManyRequests, "rate limit exceeded")
			return
		}
		next.ServeHTTP(w, r)
	})
}
