/*
# Fix ambiguous column reference in add_webhook / update_webhook

## Problem
The SECURITY DEFINER functions `add_webhook` and `update_webhook` declared a
local PL/pgSQL variable named `id`, which collides with the `webhooks.id`
column in the `RETURNING id INTO ...` clause. Postgres raises:
  ERROR: 42702: column reference "id" is ambiguous

This blocked all webhook creation and editing.

## Fix
Rename the local variable `v_id` (already used in add_webhook's RETURNING)
and ensure `update_webhook` uses a distinct variable name too. The functions
are recreated in full with unambiguous variable names.

## Security
No policy or table changes — only function bodies are replaced.
*/

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

  IF v_count > 0 AND NOT EXISTS (SELECT 1 FROM webhooks WHERE is_active) THEN
    UPDATE webhooks SET is_active = true WHERE webhooks.id = v_new_id;
  END IF;

  RETURN QUERY SELECT * FROM get_webhooks() WHERE get_webhooks.id = v_new_id;
END;
$$;

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
    UPDATE webhooks SET name = p_name, url = p_url WHERE webhooks.id = p_id;
  ELSE
    UPDATE webhooks SET name = p_name WHERE webhooks.id = p_id;
  END IF;

  RETURN QUERY SELECT * FROM get_webhooks() WHERE get_webhooks.id = p_id;
END;
$$;

-- Re-grant execute (CREATE OR REPLACE resets grants)
REVOKE ALL ON FUNCTION add_webhook(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_webhook(text, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION update_webhook(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_webhook(uuid, text, text) TO anon, authenticated;
