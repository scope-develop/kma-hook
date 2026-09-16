/*
# KMA Tools — Discord Webhook Suite schema (single-tenant, no auth)

## Summary
KMA Tools is a single-tenant admin dashboard for managing Discord webhooks and sending
messages/embeds through them. There is no sign-in screen, so the frontend talks to
Supabase with the anon key for its entire lifetime. All tables therefore use
`TO anon, authenticated` policies so the anon-key client can read and write its own data.

## Security model (important)
Discord webhook URLs are secrets: anyone who has the URL can send messages as the bot.
They must NEVER be exposed to the browser. The `webhooks` table stores the full URL, but:
  - The SELECT policy is restricted so the frontend only ever receives a MASKED version
    of the url (via a SECURITY DEFINER function `get_webhooks`, which returns everything
    EXCEPT the token portion of the URL). The raw `webhooks` table has NO anon SELECT
    policy, so the anon role cannot read full URLs directly.
  - All writes (insert/update/delete) go through SECURITY DEFINER functions that run
    with the service role, so the anon role never needs direct INSERT/UPDATE/DELETE on
    the raw table. This prevents the anon key from reading back the full URL it just
    wrote.
  - All Discord API calls (send message, send embed, test webhook) are proxied through
    an edge function that reads the full URL from the database using the service role
    key. The full URL never reaches the browser.

## New Tables
1. `webhooks`
   - `id` (uuid, pk)
   - `name` (text) — friendly label
   - `url` (text) — full Discord webhook URL (secret)
   - `is_active` (boolean, default false) — only one should be active at a time
   - `status` (text) — 'unknown' | 'operational' | 'error' | 'warning'
   - `last_http_status` (int) — last HTTP status code from a test
   - `last_latency_ms` (int) — last measured latency in ms
   - `last_tested_at` (timestamptz)
   - `created_at` (timestamptz)

2. `templates`
   - `id` (uuid, pk)
   - `name` (text)
   - `kind` (text) — 'message' | 'embed'
   - `payload` (jsonb) — full message or embed body
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

3. `history`
   - `id` (uuid, pk)
   - `action` (text) — 'MESSAGE' | 'EMBED' | 'TEMPLATE'
   - `content` (text) — short description / preview of what was sent
   - `status` (text) — 'success' | 'error'
   - `detail` (text) — optional error message or extra info
   - `created_at` (timestamptz)

4. `settings`
   - `id` (int, pk, always 1) — singleton row
   - `bot_name` (text, default 'KMA Bot')
   - `avatar_url` (text, nullable)
   - `hide_urls` (boolean, default true) — mask webhook URLs in the UI
   - `updated_at` (timestamptz)

5. `stats`
   - `id` (int, pk, always 1) — singleton row
   - `messages_sent` (int, default 0)
   - `embeds_sent` (int, default 0)
   - `errors` (int, default 0)
   - `last_action` (text, nullable)
   - `last_action_at` (timestamptz, nullable)
   - `updated_at` (timestamptz)

## Functions (SECURITY DEFINER)
- `get_webhooks()` — returns all webhooks with the url MASKED (token replaced with ***).
  SECURITY DEFINER so it can read the raw url column while the caller (anon) cannot.
- `add_webhook(p_name text, p_url text)` — inserts a webhook, returns the new row (masked url).
  Validates that the url looks like a Discord webhook url. If it is the first webhook,
  it is marked active. SECURITY DEFINER.
- `update_webhook(p_id uuid, p_name text, p_url text)` — updates name and optionally url.
  Returns the updated row (masked). SECURITY DEFINER.
- `delete_webhook(p_id uuid)` — deletes a webhook. If the deleted one was active and
  others remain, activates the first remaining. SECURITY DEFINER.
- `set_active_webhook(p_id uuid)` — marks exactly one webhook as active. SECURITY DEFINER.
- `get_settings()` — returns the singleton settings row, creating it if missing.
  SECURITY DEFINER.
- `save_settings(p_bot_name text, p_avatar_url text, p_hide_urls boolean)` — upserts
  the singleton settings row. SECURITY DEFINER.
- `record_history(p_action text, p_content text, p_status text, p_detail text)` — inserts
  a history row and updates the singleton stats row (incrementing the right counter
  based on action/status and setting last_action/last_action_at). SECURITY DEFINER.
- `clear_history()` — truncates the history table. SECURITY DEFINER.

## Security changes (RLS)
- `webhooks`: RLS enabled. NO direct SELECT/INSERT/UPDATE/DELETE policies for anon —
  all access is through SECURITY DEFINER functions. (Authenticated/service role still
  bypass RLS, which is fine for the edge function.)
- `templates`: RLS enabled. Full anon+authenticated CRUD (single-tenant shared data).
- `history`: RLS enabled. SELECT + INSERT for anon (writes go through record_history,
  but direct insert is harmless). DELETE is NOT granted to anon — clearing goes through
  the clear_history() SECURITY DEFINER function.
- `settings`: RLS enabled. NO direct SELECT/UPDATE for anon — access through
  get_settings()/save_settings() SECURITY DEFINER functions.
- `stats`: RLS enabled. SELECT for anon (read-only). No direct writes for anon —
  updates happen inside record_history() which runs as service role.
*/

-- =========================================================
-- webhooks
-- =========================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'unknown',
  last_http_status int,
  last_latency_ms int,
  last_tested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- templates
-- =========================================================
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'embed',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_templates" ON templates;
CREATE POLICY "anon_select_templates" ON templates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_templates" ON templates;
CREATE POLICY "anon_insert_templates" ON templates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_templates" ON templates;
CREATE POLICY "anon_update_templates" ON templates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_templates" ON templates;
CREATE POLICY "anon_delete_templates" ON templates FOR DELETE
  TO anon, authenticated USING (true);

-- =========================================================
-- history
-- =========================================================
CREATE TABLE IF NOT EXISTS history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success',
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_history" ON history;
CREATE POLICY "anon_select_history" ON history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_history" ON history;
CREATE POLICY "anon_insert_history" ON history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- =========================================================
-- settings (singleton)
-- =========================================================
CREATE TABLE IF NOT EXISTS settings (
  id int PRIMARY KEY DEFAULT 1,
  bot_name text NOT NULL DEFAULT 'KMA Bot',
  avatar_url text,
  hide_urls boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_singleton CHECK (id = 1)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- =========================================================
-- stats (singleton)
-- =========================================================
CREATE TABLE IF NOT EXISTS stats (
  id int PRIMARY KEY DEFAULT 1,
  messages_sent int NOT NULL DEFAULT 0,
  embeds_sent int NOT NULL DEFAULT 0,
  errors int NOT NULL DEFAULT 0,
  last_action text,
  last_action_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stats_singleton CHECK (id = 1)
);

ALTER TABLE stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_stats" ON stats;
CREATE POLICY "anon_select_stats" ON stats FOR SELECT
  TO anon, authenticated USING (true);

-- =========================================================
-- Seed singleton rows
-- =========================================================
INSERT INTO settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO stats (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- SECURITY DEFINER functions (run as service role)
-- =========================================================
-- We revoke EXECUTE from anon/authenticated by default, then GRANT EXECUTE
-- only on the ones the frontend needs to call.

-- get_webhooks(): returns webhooks with the url token masked.
CREATE OR REPLACE FUNCTION get_webhooks()
RETURNS TABLE (
  id uuid,
  name text,
  url_masked text,
  is_active boolean,
  status text,
  last_http_status int,
  last_latency_ms int,
  last_tested_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.name,
    -- mask the token portion: https://discord.com/api/webhooks/<id>/<token>
    regexp_replace(w.url, '(https://discord(app)?\.com/api/webhooks/[0-9]+/)[^/]+', '\1••••••••') AS url_masked,
    w.is_active,
    w.status,
    w.last_http_status,
    w.last_latency_ms,
    w.last_tested_at,
    w.created_at
  FROM webhooks w
  ORDER BY w.created_at ASC;
END;
$$;

-- add_webhook(p_name, p_url)
CREATE OR REPLACE FUNCTION add_webhook(p_name text, p_url text)
RETURNS TABLE (
  id uuid,
  name text,
  url_masked text,
  is_active boolean,
  status text,
  last_http_status int,
  last_latency_ms int,
  last_tested_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_count int;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://discord(app)?\.com/api/webhooks/[0-9]+/.+' THEN
    RAISE EXCEPTION 'Invalid Discord webhook URL';
  END IF;

  SELECT count(*) INTO v_count FROM webhooks;
  INSERT INTO webhooks (name, url, is_active)
  VALUES (p_name, p_url, (v_count = 0))
  RETURNING id INTO v_id;

  -- If this was the first webhook, it is already active; otherwise activate it if none active.
  IF v_count > 0 AND NOT EXISTS (SELECT 1 FROM webhooks WHERE is_active) THEN
    UPDATE webhooks SET is_active = true WHERE id = v_id;
  END IF;

  RETURN QUERY SELECT * FROM get_webhooks() WHERE id = v_id;
END;
$$;

-- update_webhook(p_id, p_name, p_url) — p_url null/empty means keep existing url
CREATE OR REPLACE FUNCTION update_webhook(p_id uuid, p_name text, p_url text)
RETURNS TABLE (
  id uuid,
  name text,
  url_masked text,
  is_active boolean,
  status text,
  last_http_status int,
  last_latency_ms int,
  last_tested_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_url IS NOT NULL AND p_url <> '' AND p_url !~ '^https://discord(app)?\.com/api/webhooks/[0-9]+/.+' THEN
    RAISE EXCEPTION 'Invalid Discord webhook URL';
  END IF;

  IF p_url IS NOT NULL AND p_url <> '' THEN
    UPDATE webhooks SET name = p_name, url = p_url WHERE id = p_id;
  ELSE
    UPDATE webhooks SET name = p_name WHERE id = p_id;
  END IF;

  RETURN QUERY SELECT * FROM get_webhooks() WHERE id = p_id;
END;
$$;

-- delete_webhook(p_id)
CREATE OR REPLACE FUNCTION delete_webhook(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_active boolean;
  v_first_id uuid;
BEGIN
  SELECT is_active INTO v_was_active FROM webhooks WHERE id = p_id;
  DELETE FROM webhooks WHERE id = p_id;
  IF v_was_active AND EXISTS (SELECT 1 FROM webhooks) THEN
    SELECT id INTO v_first_id FROM webhooks ORDER BY created_at ASC LIMIT 1;
    UPDATE webhooks SET is_active = true WHERE id = v_first_id;
  END IF;
END;
$$;

-- set_active_webhook(p_id)
CREATE OR REPLACE FUNCTION set_active_webhook(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE webhooks SET is_active = (id = p_id);
END;
$$;

-- record_webhook_test(p_id, p_status, p_http, p_latency)
-- Called by the edge function after testing a webhook so the UI reflects the result.
CREATE OR REPLACE FUNCTION record_webhook_test(
  p_id uuid,
  p_status text,
  p_http int,
  p_latency int
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE webhooks
  SET status = p_status,
      last_http_status = p_http,
      last_latency_ms = p_latency,
      last_tested_at = now()
  WHERE id = p_id;
END;
$$;

-- get_settings()
CREATE OR REPLACE FUNCTION get_settings()
RETURNS TABLE (
  id int,
  bot_name text,
  avatar_url text,
  hide_urls boolean,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
  RETURN QUERY SELECT * FROM settings WHERE id = 1;
END;
$$;

-- save_settings(p_bot_name, p_avatar_url, p_hide_urls)
CREATE OR REPLACE FUNCTION save_settings(
  p_bot_name text,
  p_avatar_url text,
  p_hide_urls boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO settings (id, bot_name, avatar_url, hide_urls, updated_at)
  VALUES (1, COALESCE(p_bot_name, 'KMA Bot'), p_avatar_url, COALESCE(p_hide_urls, true), now())
  ON CONFLICT (id) DO UPDATE
  SET bot_name = EXCLUDED.bot_name,
      avatar_url = EXCLUDED.avatar_url,
      hide_urls = EXCLUDED.hide_urls,
      updated_at = now();
END;
$$;

-- record_history(p_action, p_content, p_status, p_detail)
-- Also updates the singleton stats row.
CREATE OR REPLACE FUNCTION record_history(
  p_action text,
  p_content text,
  p_status text,
  p_detail text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO history (action, content, status, detail)
  VALUES (p_action, p_content, p_status, p_detail);

  UPDATE stats SET
    messages_sent = messages_sent + CASE WHEN p_action = 'MESSAGE' AND p_status = 'success' THEN 1 ELSE 0 END,
    embeds_sent   = embeds_sent   + CASE WHEN p_action = 'EMBED'   AND p_status = 'success' THEN 1 ELSE 0 END,
    errors        = errors        + CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    last_action   = p_action,
    last_action_at = now(),
    updated_at = now()
  WHERE id = 1;
END;
$$;

-- clear_history()
CREATE OR REPLACE FUNCTION clear_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE history;
END;
$$;

-- Revoke all, then grant EXECUTE only on the functions the frontend needs.
REVOKE ALL ON FUNCTION get_webhooks FROM PUBLIC;
REVOKE ALL ON FUNCTION add_webhook(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION update_webhook(uuid, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION delete_webhook(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION set_active_webhook(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_webhook_test(uuid, text, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION save_settings(text, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_history(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION clear_history() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_webhooks TO anon, authenticated;
GRANT EXECUTE ON FUNCTION add_webhook(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_webhook(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION delete_webhook(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION set_active_webhook(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_webhook_test(uuid, text, int, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION save_settings(text, text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_history(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION clear_history() TO anon, authenticated;
