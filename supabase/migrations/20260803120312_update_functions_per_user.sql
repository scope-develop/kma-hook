/*
# Update SECURITY DEFINER functions for per-user isolation

## Summary
All webhook, settings, stats, and history functions now filter by
auth.uid() so each user only sees their own data. The functions use
auth.uid() to scope queries and inserts.

## Changes
1. get_webhooks() — only returns webhooks WHERE user_id = auth.uid()
2. add_webhook() — inserts with user_id = auth.uid()
3. update_webhook() — only updates webhooks WHERE user_id = auth.uid()
4. delete_webhook() — only deletes WHERE user_id = auth.uid()
5. set_active_webhook() — only affects webhooks WHERE user_id = auth.uid()
6. record_webhook_test() — only updates WHERE user_id = auth.uid()
7. get_settings() — returns/creates settings for auth.uid()
8. save_settings() — upserts settings for auth.uid()
9. record_history() — inserts history with user_id = auth.uid(),
   updates stats for auth.uid()
10. clear_history() — only truncates? No — deletes WHERE user_id = auth.uid()

## Security
All functions are SECURITY DEFINER with search_path = public.
Functions that accept IDs (update_webhook, delete_webhook, etc.) verify
ownership before acting — a user cannot modify another user's webhook
even by guessing its ID.
*/

-- =========================================================
-- get_webhooks() — scoped to current user
-- =========================================================
DROP FUNCTION IF EXISTS get_webhooks();
CREATE FUNCTION get_webhooks()
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
    regexp_replace(w.url, '(https://discord(app)?\.com/api/webhooks/[0-9]+/)[^/]+', '\1••••••••'),
    w.is_active,
    w.status,
    w.last_http_status,
    w.last_latency_ms,
    w.last_tested_at,
    w.created_at
  FROM webhooks w
  WHERE w.user_id = auth.uid()
  ORDER BY w.created_at ASC;
END;
$$;
ALTER FUNCTION get_webhooks() SECURITY DEFINER;
ALTER FUNCTION get_webhooks() SET search_path = public;
REVOKE ALL ON FUNCTION get_webhooks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_webhooks() TO authenticated;

-- =========================================================
-- add_webhook() — inserts with current user
-- =========================================================
DROP FUNCTION IF EXISTS add_webhook(text, text);
CREATE FUNCTION add_webhook(p_name text, p_url text)
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
  v_new_id uuid;
  v_count int;
BEGIN
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://discord(app)?\.com/api/webhooks/[0-9]+/.+' THEN
    RAISE EXCEPTION 'Invalid Discord webhook URL';
  END IF;

  SELECT count(*) INTO v_count FROM webhooks WHERE webhooks.user_id = auth.uid();
  INSERT INTO webhooks (name, url, is_active, user_id)
  VALUES (p_name, p_url, (v_count = 0), auth.uid())
  RETURNING webhooks.id INTO v_new_id;

  IF v_count > 0 AND NOT EXISTS (
    SELECT 1 FROM webhooks wh WHERE wh.is_active AND wh.user_id = auth.uid()
  ) THEN
    UPDATE webhooks SET is_active = true WHERE webhooks.id = v_new_id;
  END IF;

  RETURN QUERY
  SELECT
    w.id, w.name,
    regexp_replace(w.url, '(https://discord(app)?\.com/api/webhooks/[0-9]+/)[^/]+', '\1••••••••'),
    w.is_active, w.status, w.last_http_status, w.last_latency_ms, w.last_tested_at, w.created_at
  FROM webhooks w
  WHERE w.id = v_new_id AND w.user_id = auth.uid();
END;
$$;
ALTER FUNCTION add_webhook(text, text) SECURITY DEFINER;
ALTER FUNCTION add_webhook(text, text) SET search_path = public;
REVOKE ALL ON FUNCTION add_webhook(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_webhook(text, text) TO authenticated;

-- =========================================================
-- update_webhook() — ownership verified
-- =========================================================
DROP FUNCTION IF EXISTS update_webhook(uuid, text, text);
CREATE FUNCTION update_webhook(p_id uuid, p_name text, p_url text)
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

  -- Verify ownership
  IF NOT EXISTS (SELECT 1 FROM webhooks w WHERE w.id = p_id AND w.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Webhook not found';
  END IF;

  IF p_url IS NOT NULL AND p_url <> '' THEN
    UPDATE webhooks SET name = p_name, url = p_url WHERE webhooks.id = p_id;
  ELSE
    UPDATE webhooks SET name = p_name WHERE webhooks.id = p_id;
  END IF;

  RETURN QUERY
  SELECT
    w.id, w.name,
    regexp_replace(w.url, '(https://discord(app)?\.com/api/webhooks/[0-9]+/)[^/]+', '\1••••••••'),
    w.is_active, w.status, w.last_http_status, w.last_latency_ms, w.last_tested_at, w.created_at
  FROM webhooks w
  WHERE w.id = p_id AND w.user_id = auth.uid();
END;
$$;
ALTER FUNCTION update_webhook(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION update_webhook(uuid, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION update_webhook(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_webhook(uuid, text, text) TO authenticated;

-- =========================================================
-- delete_webhook() — ownership verified
-- =========================================================
DROP FUNCTION IF EXISTS delete_webhook(uuid);
CREATE FUNCTION delete_webhook(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_was_active boolean;
  v_first_id uuid;
BEGIN
  SELECT is_active INTO v_was_active FROM webhooks
  WHERE webhooks.id = p_id AND webhooks.user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Webhook not found';
  END IF;

  DELETE FROM webhooks WHERE webhooks.id = p_id AND webhooks.user_id = auth.uid();

  IF v_was_active AND EXISTS (
    SELECT 1 FROM webhooks w WHERE w.user_id = auth.uid()
  ) THEN
    SELECT id INTO v_first_id FROM webhooks
    WHERE webhooks.user_id = auth.uid()
    ORDER BY created_at ASC LIMIT 1;
    UPDATE webhooks SET is_active = true WHERE webhooks.id = v_first_id;
  END IF;
END;
$$;
ALTER FUNCTION delete_webhook(uuid) SECURITY DEFINER;
ALTER FUNCTION delete_webhook(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION delete_webhook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_webhook(uuid) TO authenticated;

-- =========================================================
-- set_active_webhook() — only affects current user's webhooks
-- =========================================================
DROP FUNCTION IF EXISTS set_active_webhook(uuid);
CREATE FUNCTION set_active_webhook(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM webhooks w WHERE w.id = p_id AND w.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Webhook not found';
  END IF;
  UPDATE webhooks SET is_active = (webhooks.id = p_id)
  WHERE webhooks.user_id = auth.uid();
END;
$$;
ALTER FUNCTION set_active_webhook(uuid) SECURITY DEFINER;
ALTER FUNCTION set_active_webhook(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION set_active_webhook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_active_webhook(uuid) TO authenticated;

-- =========================================================
-- record_webhook_test() — ownership verified
-- =========================================================
DROP FUNCTION IF EXISTS record_webhook_test(uuid, text, int, int);
CREATE FUNCTION record_webhook_test(
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
  WHERE webhooks.id = p_id AND webhooks.user_id = auth.uid();
END;
$$;
ALTER FUNCTION record_webhook_test(uuid, text, int, int) SECURITY DEFINER;
ALTER FUNCTION record_webhook_test(uuid, text, int, int) SET search_path = public;
REVOKE ALL ON FUNCTION record_webhook_test(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_webhook_test(uuid, text, int, int) TO authenticated;

-- =========================================================
-- get_settings() — per-user singleton
-- =========================================================
DROP FUNCTION IF EXISTS get_settings();
CREATE FUNCTION get_settings()
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
DECLARE
  v_next_id int;
BEGIN
  -- Ensure a settings row exists for this user
  INSERT INTO settings (id, user_id, bot_name, avatar_url, hide_urls, updated_at)
  SELECT
    COALESCE((SELECT max(id) + 1 FROM settings), 1),
    auth.uid(),
    'KMA Bot',
    NULL,
    true,
    now()
  WHERE NOT EXISTS (SELECT 1 FROM settings s WHERE s.user_id = auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN QUERY
  SELECT s.id, s.bot_name, s.avatar_url, s.hide_urls, s.updated_at
  FROM settings s
  WHERE s.user_id = auth.uid();
END;
$$;
ALTER FUNCTION get_settings() SECURITY DEFINER;
ALTER FUNCTION get_settings() SET search_path = public;
REVOKE ALL ON FUNCTION get_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_settings() TO authenticated;

-- =========================================================
-- save_settings() — per-user upsert
-- =========================================================
DROP FUNCTION IF EXISTS save_settings(text, text, boolean);
CREATE FUNCTION save_settings(
  p_bot_name text,
  p_avatar_url text,
  p_hide_urls boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id int;
BEGIN
  SELECT id INTO v_existing_id FROM settings WHERE settings.user_id = auth.uid();

  IF v_existing_id IS NOT NULL THEN
    UPDATE settings SET
      bot_name = COALESCE(p_bot_name, 'KMA Bot'),
      avatar_url = p_avatar_url,
      hide_urls = COALESCE(p_hide_urls, true),
      updated_at = now()
    WHERE settings.user_id = auth.uid();
  ELSE
    INSERT INTO settings (id, user_id, bot_name, avatar_url, hide_urls, updated_at)
    VALUES (
      COALESCE((SELECT max(id) + 1 FROM settings), 1),
      auth.uid(),
      COALESCE(p_bot_name, 'KMA Bot'),
      p_avatar_url,
      COALESCE(p_hide_urls, true),
      now()
    );
  END IF;
END;
$$;
ALTER FUNCTION save_settings(text, text, boolean) SECURITY DEFINER;
ALTER FUNCTION save_settings(text, text, boolean) SET search_path = public;
REVOKE ALL ON FUNCTION save_settings(text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION save_settings(text, text, boolean) TO authenticated;

-- =========================================================
-- record_history() — per-user, updates per-user stats
-- =========================================================
DROP FUNCTION IF EXISTS record_history(text, text, text, text);
CREATE FUNCTION record_history(
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
DECLARE
  v_stats_id int;
BEGIN
  INSERT INTO history (action, content, status, detail, user_id)
  VALUES (p_action, p_content, p_status, p_detail, auth.uid());

  -- Ensure stats row exists for this user
  SELECT id INTO v_stats_id FROM stats WHERE stats.user_id = auth.uid();
  IF v_stats_id IS NULL THEN
    INSERT INTO stats (id, user_id, messages_sent, embeds_sent, errors, last_action, last_action_at, updated_at)
    VALUES (
      COALESCE((SELECT max(id) + 1 FROM stats), 1),
      auth.uid(), 0, 0, 0, NULL, NULL, now()
    )
    ON CONFLICT DO NOTHING;
  END IF;

  UPDATE stats SET
    messages_sent = messages_sent + CASE WHEN p_action = 'MESSAGE' AND p_status = 'success' THEN 1 ELSE 0 END,
    embeds_sent   = embeds_sent   + CASE WHEN p_action = 'EMBED'   AND p_status = 'success' THEN 1 ELSE 0 END,
    errors        = errors        + CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    last_action   = p_action,
    last_action_at = now(),
    updated_at = now()
  WHERE stats.user_id = auth.uid();
END;
$$;
ALTER FUNCTION record_history(text, text, text, text) SECURITY DEFINER;
ALTER FUNCTION record_history(text, text, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION record_history(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_history(text, text, text, text) TO authenticated;

-- =========================================================
-- clear_history() — only clears current user's history
-- =========================================================
DROP FUNCTION IF EXISTS clear_history();
CREATE FUNCTION clear_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM history WHERE history.user_id = auth.uid();
END;
$$;
ALTER FUNCTION clear_history() SECURITY DEFINER;
ALTER FUNCTION clear_history() SET search_path = public;
REVOKE ALL ON FUNCTION clear_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clear_history() TO authenticated;
