ALTER TABLE links ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE links ADD COLUMN stats_token TEXT;
-- 32 hex chars from two random UUIDs; new rows get 24 alphanumeric chars from the app.
UPDATE links SET stats_token = substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 32);
ALTER TABLE links ALTER COLUMN stats_token SET NOT NULL;
ALTER TABLE links ADD CONSTRAINT links_stats_token_key UNIQUE (stats_token);
