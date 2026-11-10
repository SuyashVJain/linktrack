package main

import (
	"context"
	"embed"
	"sort"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// migrate applies each migration file once, in name order, tracked in schema_migrations.
func migrate(ctx context.Context, db *pgxpool.Pool) error {
	if _, err := db.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY)`); err != nil {
		return err
	}
	files, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Name() < files[j].Name() })
	for _, f := range files {
		var done bool
		if err := db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, f.Name()).Scan(&done); err != nil {
			return err
		}
		if done {
			continue
		}
		sql, err := migrationFS.ReadFile("migrations/" + f.Name())
		if err != nil {
			return err
		}
		tx, err := db.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			tx.Rollback(ctx)
			return err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(name) VALUES($1)`, f.Name()); err != nil {
			tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}
