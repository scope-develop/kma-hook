/*
# Fix API Key Functions — Search Path

## Summary
The pgcrypto extension is installed in the `extensions` schema, but the API key
functions had `SET search_path = public`, meaning `digest()` and `gen_random_bytes()`
were not found at runtime. This updates all three functions to use `SET search_path = public, extensions`
so the pgcrypto functions resolve correctly.

## Changes
- `create_api_key(text)` — updated search_path to include extensions schema
- `lookup_api_key(text, text)` — updated search_path to include extensions schema
*/

DROP FUNCTION IF EXISTS create_api_key(text);
CREATE FUNCTION create_api_key(p_name text DEFAULT 'Default')
RETURNS TABLE (id uuid, key text, name text, key_prefix text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
ALTER FUNCTION create_api_key(text) SET search_path = public, extensions;
REVOKE ALL ON FUNCTION create_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_api_key(text) TO authenticated;

DROP FUNCTION IF EXISTS lookup_api_key(text, text);
CREATE FUNCTION lookup_api_key(p_key text, p_ip text DEFAULT NULL)
RETURNS TABLE (user_id uuid, is_valid boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
ALTER FUNCTION lookup_api_key(text, text) SET search_path = public, extensions;
REVOKE ALL ON FUNCTION lookup_api_key(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION lookup_api_key(text, text) TO authenticated;
