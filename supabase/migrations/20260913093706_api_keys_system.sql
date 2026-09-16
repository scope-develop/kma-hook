/*
# API Keys System

## Summary
Adds an API key system so external scripts and bots can send messages and embeds
through the KMA Tools edge function without logging into the web UI. Each user can
create multiple API keys with names, track last-used timestamps, and revoke them.

## New Tables
1. `api_keys` — id, user_id, name, key_hash, key_prefix, last_used_at, last_used_ip, created_at, revoked_at

## Security
- RLS enabled on api_keys, users only see/manage their own keys
- Key hash stored as SHA-256, raw key returned only once at creation
- All functions are SECURITY DEFINER with search_path = public
*/

-- =========================================================
-- 1. api_keys table
-- =========================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  last_used_at timestamptz,
  last_used_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_hash_idx ON api_keys (key_hash) WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_api_keys" ON api_keys;
CREATE POLICY "select_own_api_keys" ON api_keys FOR SELECT
  TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "insert_own_api_keys" ON api_keys;
CREATE POLICY "insert_own_api_keys" ON api_keys FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_api_keys" ON api_keys;
CREATE POLICY "update_own_api_keys" ON api_keys FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_api_keys" ON api_keys;
CREATE POLICY "delete_own_api_keys" ON api_keys FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- =========================================================
-- 2. CRUD functions
-- =========================================================

DROP FUNCTION IF EXISTS create_api_key(text);
CREATE FUNCTION create_api_key(p_name text DEFAULT 'Default')
RETURNS TABLE (id uuid, key text, name text, key_prefix text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw text;
  v_hash text;
  v_prefix text;
  v_id uuid;
  v_created timestamptz;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    p_name := 'Default';
  END IF;

  v_raw := encode(gen_random_bytes(32), 'hex');
  v_hash := encode(digest(v_raw, 'sha256'), 'hex');
  v_prefix := left(v_raw, 10);

  INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
  VALUES (auth.uid(), p_name, v_hash, v_prefix)
  RETURNING id, created_at INTO v_id, v_created;

  RETURN QUERY SELECT v_id, v_raw, p_name, v_prefix, v_created;
END;
$$;
ALTER FUNCTION create_api_key(text) SECURITY DEFINER;
ALTER FUNCTION create_api_key(text) SET search_path = public;
REVOKE ALL ON FUNCTION create_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_api_key(text) TO authenticated;

DROP FUNCTION IF EXISTS get_api_keys();
CREATE FUNCTION get_api_keys()
RETURNS TABLE (
  id uuid, name text, key_prefix text, last_used_at timestamptz,
  last_used_ip text, created_at timestamptz, revoked_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT k.id, k.name, k.key_prefix, k.last_used_at, k.last_used_ip,
         k.created_at, k.revoked_at
  FROM api_keys k
  WHERE k.user_id = auth.uid()
  ORDER BY k.created_at DESC;
END;
$$;
ALTER FUNCTION get_api_keys() SECURITY DEFINER;
ALTER FUNCTION get_api_keys() SET search_path = public;
REVOKE ALL ON FUNCTION get_api_keys() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_api_keys() TO authenticated;

DROP FUNCTION IF EXISTS revoke_api_key(uuid);
CREATE FUNCTION revoke_api_key(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE api_keys SET revoked_at = now()
  WHERE id = p_id AND user_id = auth.uid() AND revoked_at IS NULL;
END;
$$;
ALTER FUNCTION revoke_api_key(uuid) SECURITY DEFINER;
ALTER FUNCTION revoke_api_key(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION revoke_api_key(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revoke_api_key(uuid) TO authenticated;

-- =========================================================
-- 3. Lookup function for edge function auth
-- =========================================================
DROP FUNCTION IF EXISTS lookup_api_key(text, text);
CREATE FUNCTION lookup_api_key(p_key text, p_ip text DEFAULT NULL)
RETURNS TABLE (user_id uuid, is_valid boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash text;
  v_uid uuid;
BEGIN
  v_hash := encode(digest(p_key, 'sha256'), 'hex');

  SELECT user_id INTO v_uid
  FROM api_keys
  WHERE key_hash = v_hash AND revoked_at IS NULL
  LIMIT 1;

  IF v_uid IS NOT NULL THEN
    UPDATE api_keys SET last_used_at = now(), last_used_ip = p_ip
    WHERE key_hash = v_hash AND revoked_at IS NULL;
    RETURN QUERY SELECT v_uid, true;
  ELSE
    RETURN QUERY SELECT NULL::uuid, false;
  END IF;
END;
$$;
ALTER FUNCTION lookup_api_key(text, text) SECURITY DEFINER;
ALTER FUNCTION lookup_api_key(text, text) SET search_path = public;
REVOKE ALL ON FUNCTION lookup_api_key(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_api_key(text, text) TO authenticated;
