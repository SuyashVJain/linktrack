package main

import "testing"

func TestGenerateSlug(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		s := generateSlug(6)
		if len(s) != 6 || validateSlug(s) != nil {
			t.Fatalf("bad slug %q", s)
		}
		seen[s] = true
	}
	if len(seen) < 190 {
		t.Fatalf("too many collisions: %d unique of 200", len(seen))
	}
}

func TestValidateSlug(t *testing.T) {
	tests := []struct {
		in string
		ok bool
	}{
		{"abc", true}, {"my-link_1", true}, {"ab", false}, {"has space", false},
		{"api", false}, {"healthz", false}, {"a/b", false}, {"", false},
	}
	for _, tc := range tests {
		if got := validateSlug(tc.in) == nil; got != tc.ok {
			t.Errorf("validateSlug(%q) ok=%v, want %v", tc.in, got, tc.ok)
		}
	}
}

func TestValidateURL(t *testing.T) {
	tests := []struct {
		in string
		ok bool
	}{
		{"https://example.com", true}, {"http://example.com/a?b=c", true},
		{"ftp://example.com", false}, {"javascript:alert(1)", false},
		{"example.com", false}, {"http://", false}, {"", false}, {"https://", false},
	}
	for _, tc := range tests {
		if got := validateURL(tc.in) == nil; got != tc.ok {
			t.Errorf("validateURL(%q) ok=%v, want %v", tc.in, got, tc.ok)
		}
	}
}
