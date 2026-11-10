CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE links (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug TEXT NOT NULL UNIQUE,
    target_url TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX links_user_id_idx ON links(user_id);

CREATE TABLE clicks (
    id BIGSERIAL PRIMARY KEY,
    link_id BIGINT NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    referrer TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    country TEXT
);
CREATE INDEX clicks_link_time_idx ON clicks(link_id, clicked_at);
