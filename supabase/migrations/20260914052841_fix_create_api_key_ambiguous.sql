/*
# Fix: Ambiguous column reference in create_api_key

## Summary
The `RETURNING id, created_at` clause was ambiguous because the function's
return type TABLE(id uuid, ...) conflicts with the table's `id` column.
Fixed by aliasing the RETURNING columns explicitly.
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
  RETURNING api_keys.id, api_keys.created_at INTO v_id, v_created;

  RETURN QUERY SELECT v_id, v_raw, p_name, v_prefix, v_created;
END;
$$;
ALTER FUNCTION create_api_key(text) SECURITY DEFINER;
ALTER FUNCTION create_api_key(text) SET search_path = public, extensions;
REVOKE ALL ON FUNCTION create_api_key(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_api_key(text) TO authenticated;
