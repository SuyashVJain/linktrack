package main

import (
	"log"
	"os"
)

type Config struct {
	Addr        string
	DatabaseURL string
	JWTSecret   string
	StaticDir   string
	BaseURL     string
	TrustProxy  bool
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func loadConfig() Config {
	c := Config{
		Addr:        getenv("ADDR", ":8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
		StaticDir:   os.Getenv("STATIC_DIR"),
		BaseURL:     getenv("BASE_URL", "http://localhost:8080"),
		TrustProxy:  os.Getenv("TRUST_PROXY") == "true",
	}
	if c.DatabaseURL == "" || c.JWTSecret == "" {
		log.Fatal("DATABASE_URL and JWT_SECRET are required")
	}
	return c
}
