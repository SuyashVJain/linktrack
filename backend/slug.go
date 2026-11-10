package main

import (
	"crypto/rand"
	"errors"
	"net/url"
	"regexp"
)

const slugAlphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// generateSlug returns n random alphanumeric characters.
func generateSlug(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	for i := range b {
		b[i] = slugAlphabet[int(b[i])%len(slugAlphabet)] // slight modulo bias is irrelevant for slugs
	}
	return string(b)
}

var slugRe = regexp.MustCompile(`^[A-Za-z0-9_-]{3,32}$`)

// reservedSlugs would collide with the API or health routes.
var reservedSlugs = map[string]bool{"api": true, "healthz": true, "app": true}

func validateSlug(s string) error {
	if !slugRe.MatchString(s) || reservedSlugs[s] {
		return errors.New("slug must be 3-32 chars of letters, digits, - or _, and not reserved")
	}
	return nil
}

func validateURL(raw string) error {
	if len(raw) > 2048 {
		return errors.New("url too long")
	}
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return errors.New("url must be a valid http or https URL")
	}
	return nil
}
