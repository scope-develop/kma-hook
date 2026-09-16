/*
# Restore original output column names for webhook functions

## Problem
Renaming output columns to out_* broke the frontend which expects id, name,
url_masked, is_active, etc. The original ambiguity was from unqualified
column references, not the names themselves.

## Fix
Keep the original output column names but qualify ALL internal column
references with the table alias `w.` so there is no ambiguity between
output variables and table columns.
*/

DROP FUNCTION IF EXISTS get_webhooks();
DROP FUNCTION IF EXISTS add_webhook(text, text);
DROP FUNCTION IF EXISTS update_webhook(uuid, text, text);

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
  ORDER BY w.created_at ASC;
END;
$$;

ALTER FUNCTION get_webhooks() SECURITY DEFINER;
ALTER FUNCTION get_webhooks() SET search_path = public;
REVOKE ALL ON FUNCTION get_webhooks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_webhooks() TO anon, authenticated;

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

  SELECT count(*) INTO v_count FROM webhooks;
  INSERT INTO webhooks (name, url, is_active)
  VALUES (p_name, p_url, (v_count = 0))
  RETURNING webhooks.id INTO v_new_id;

  IF v_count > 0 AND NOT EXISTS (SELECT 1 FROM webhooks wh WHERE wh.is_active) THEN
    UPDATE webhooks SET is_active = true WHERE webhooks.id = v_new_id;
  END IF;

  RETURN QUERY
  SELECT
    w.id, w.name,
    regexp_replace(w.url, '(https://discord(app)?\.com/api/webhooks/[0-9]+/)[^/]+', '\1••••••••'),
    w.is_active, w.status, w.last_http_status, w.last_latency_ms, w.last_tested_at, w.created_at
  FROM webhooks w
  WHERE w.id = v_new_id;
END;
$$;

ALTER FUNCTION add_webhook(text, text) SECURITY DEFINER;
ALTER FUNCTION add_webhook(text, text) SET search_path = public;
REVOKE ALL ON FUNCTION add_webhook(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_webhook(text, text) TO anon, authenticated;

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
  WHERE w.id = p_id;
END;
$$;

ALTER FUNCTION update_webhook(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION update_webhook(uuid, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION update_webhook(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_webhook(uuid, text, text) TO anon, authenticated;
