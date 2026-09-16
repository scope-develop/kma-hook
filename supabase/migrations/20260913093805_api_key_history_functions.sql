/*
# API Key History Recording Functions

## Summary
Adds SECURITY DEFINER functions that accept user_id as a parameter, so the edge function
can record history and webhook tests when authenticating via API key (where auth.uid() is NULL).

## Functions
1. record_history_api(p_user_id, p_action, p_content, p_status, p_detail)
2. record_webhook_test_api(p_user_id, p_id, p_status, p_http, p_latency)
3. log_broadcast_api(p_user_id, p_content, p_kind, p_total, p_succeeded, p_failed, p_detail)
*/

DROP FUNCTION IF EXISTS record_history_api(uuid, text, text, text, text);
CREATE FUNCTION record_history_api(
  p_user_id uuid,
  p_action text,
  p_content text,
  p_status text,
  p_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO history (user_id, action, content, status, detail)
  VALUES (p_user_id, p_action, p_content, p_status, p_detail);

  UPDATE stats SET
    messages_sent = messages_sent + CASE WHEN p_action IN ('MESSAGE', 'TEMPLATE') AND p_status = 'success' THEN 1 ELSE 0 END,
    embeds_sent = embeds_sent + CASE WHEN p_action = 'EMBED' AND p_status = 'success' THEN 1 ELSE 0 END,
    errors = errors + CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    last_action = p_action,
    last_action_at = now(),
    updated_at = now()
  WHERE user_id = p_user_id;
END;
$$;
ALTER FUNCTION record_history_api(uuid, text, text, text, text) SECURITY DEFINER;
ALTER FUNCTION record_history_api(uuid, text, text, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION record_history_api(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_history_api(uuid, text, text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS record_webhook_test_api(uuid, uuid, text, int, int);
CREATE FUNCTION record_webhook_test_api(
  p_user_id uuid,
  p_id uuid,
  p_status text,
  p_http int,
  p_latency int
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE webhooks SET
    status = p_status,
    last_http_status = p_http,
    last_latency_ms = p_latency,
    last_tested_at = now()
  WHERE id = p_id AND user_id = p_user_id;
END;
$$;
ALTER FUNCTION record_webhook_test_api(uuid, uuid, text, int, int) SECURITY DEFINER;
ALTER FUNCTION record_webhook_test_api(uuid, uuid, text, int, int) SET search_path = public;
REVOKE ALL ON FUNCTION record_webhook_test_api(uuid, uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_webhook_test_api(uuid, uuid, text, int, int) TO authenticated;

DROP FUNCTION IF EXISTS log_broadcast_api(uuid, text, text, int, int, int, jsonb);
CREATE FUNCTION log_broadcast_api(
  p_user_id uuid,
  p_content text,
  p_kind text,
  p_total int,
  p_succeeded int,
  p_failed int,
  p_detail jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO broadcast_logs (user_id, content, kind, total, succeeded, failed, detail)
  VALUES (p_user_id, p_content, p_kind, p_total, p_succeeded, p_failed, p_detail);
END;
$$;
ALTER FUNCTION log_broadcast_api(uuid, text, text, int, int, int, jsonb) SECURITY DEFINER;
ALTER FUNCTION log_broadcast_api(uuid, text, text, int, int, int, jsonb) SET search_path = public;
REVOKE ALL ON FUNCTION log_broadcast_api(uuid, text, text, int, int, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_broadcast_api(uuid, text, text, int, int, int, jsonb) TO authenticated;
