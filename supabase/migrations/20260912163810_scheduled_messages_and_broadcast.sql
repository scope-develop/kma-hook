/*
# Scheduled Messages, Variable Substitution, and Multi-Webhook Broadcast

1. `scheduled_messages` table — stores messages/embeds scheduled for future delivery
2. `broadcast_logs` table — tracks results when sending to multiple webhooks at once
3. SECURITY DEFINER functions for CRUD on scheduled messages and broadcast logs
4. Variable substitution is handled in the edge function, not the DB
*/

-- =========================================================
-- 1. scheduled_messages table
-- =========================================================
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  webhook_id uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'embed')),
  payload jsonb NOT NULL DEFAULT '{}',
  scheduled_for timestamptz NOT NULL,
  recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS scheduled_messages_user_idx ON scheduled_messages (user_id);
CREATE INDEX IF NOT EXISTS scheduled_messages_status_idx ON scheduled_messages (status);
CREATE INDEX IF NOT EXISTS scheduled_messages_scheduled_for_idx ON scheduled_messages (scheduled_for);

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scheduled" ON scheduled_messages;
CREATE POLICY "select_own_scheduled" ON scheduled_messages FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_scheduled" ON scheduled_messages;
CREATE POLICY "insert_own_scheduled" ON scheduled_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_scheduled" ON scheduled_messages;
CREATE POLICY "update_own_scheduled" ON scheduled_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_scheduled" ON scheduled_messages;
CREATE POLICY "delete_own_scheduled" ON scheduled_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =========================================================
-- 2. broadcast_logs table
-- =========================================================
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'message' CHECK (kind IN ('message', 'embed')),
  total int NOT NULL DEFAULT 0,
  succeeded int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broadcast_logs_user_idx ON broadcast_logs (user_id);

ALTER TABLE broadcast_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_broadcasts" ON broadcast_logs;
CREATE POLICY "select_own_broadcasts" ON broadcast_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_broadcasts" ON broadcast_logs;
CREATE POLICY "insert_own_broadcasts" ON broadcast_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 3. CRUD functions for scheduled messages
-- =========================================================

DROP FUNCTION IF EXISTS get_scheduled_messages();
CREATE FUNCTION get_scheduled_messages()
RETURNS TABLE (
  id uuid, webhook_id uuid, webhook_name text, kind text, payload jsonb,
  scheduled_for timestamptz, recurrence text, status text, last_run_at timestamptz, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT sm.id, sm.webhook_id, w.name, sm.kind, sm.payload,
         sm.scheduled_for, sm.recurrence, sm.status, sm.last_run_at, sm.created_at
  FROM scheduled_messages sm
  JOIN webhooks w ON w.id = sm.webhook_id
  WHERE sm.user_id = auth.uid()
  ORDER BY sm.scheduled_for ASC;
END;
$$;
ALTER FUNCTION get_scheduled_messages() SECURITY DEFINER;
ALTER FUNCTION get_scheduled_messages() SET search_path = public;
REVOKE ALL ON FUNCTION get_scheduled_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_scheduled_messages() TO authenticated;

DROP FUNCTION IF EXISTS create_scheduled_message(uuid, text, jsonb, timestamptz, text);
CREATE FUNCTION create_scheduled_message(
  p_webhook_id uuid, p_kind text, p_payload jsonb, p_scheduled_for timestamptz, p_recurrence text DEFAULT 'none'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_kind NOT IN ('message', 'embed') THEN RAISE EXCEPTION 'Invalid kind'; END IF;
  IF p_recurrence NOT IN ('none', 'daily', 'weekly', 'monthly') THEN RAISE EXCEPTION 'Invalid recurrence'; END IF;
  INSERT INTO scheduled_messages (user_id, webhook_id, kind, payload, scheduled_for, recurrence)
  VALUES (auth.uid(), p_webhook_id, p_kind, p_payload, p_scheduled_for, p_recurrence)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
ALTER FUNCTION create_scheduled_message(uuid, text, jsonb, timestamptz, text) SECURITY DEFINER;
ALTER FUNCTION create_scheduled_message(uuid, text, jsonb, timestamptz, text) SET search_path = public;
REVOKE ALL ON FUNCTION create_scheduled_message(uuid, text, jsonb, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_scheduled_message(uuid, text, jsonb, timestamptz, text) TO authenticated;

DROP FUNCTION IF EXISTS cancel_scheduled_message(uuid);
CREATE FUNCTION cancel_scheduled_message(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE scheduled_messages SET status = 'cancelled'
  WHERE id = p_id AND user_id = auth.uid() AND status = 'pending';
END;
$$;
ALTER FUNCTION cancel_scheduled_message(uuid) SECURITY DEFINER;
ALTER FUNCTION cancel_scheduled_message(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION cancel_scheduled_message(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_scheduled_message(uuid) TO authenticated;

-- =========================================================
-- 4. Get due scheduled messages (for edge function processing)
-- =========================================================
DROP FUNCTION IF EXISTS get_due_scheduled_messages();
CREATE FUNCTION get_due_scheduled_messages()
RETURNS TABLE (
  id uuid, webhook_id uuid, webhook_url text, kind text, payload jsonb,
  recurrence text, scheduled_for timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT sm.id, sm.webhook_id, w.url, sm.kind, sm.payload, sm.recurrence, sm.scheduled_for
  FROM scheduled_messages sm
  JOIN webhooks w ON w.id = sm.webhook_id
  WHERE sm.status = 'pending' AND sm.scheduled_for <= now()
  LIMIT 50;
END;
$$;
ALTER FUNCTION get_due_scheduled_messages() SECURITY DEFINER;
ALTER FUNCTION get_due_scheduled_messages() SET search_path = public;
REVOKE ALL ON FUNCTION get_due_scheduled_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_due_scheduled_messages() TO authenticated;

DROP FUNCTION IF EXISTS mark_scheduled_sent(uuid, text);
CREATE FUNCTION mark_scheduled_sent(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_recurrence text; v_scheduled timestamptz;
BEGIN
  SELECT recurrence, scheduled_for INTO v_recurrence, v_scheduled
  FROM scheduled_messages WHERE id = p_id;

  IF v_recurrence = 'none' THEN
    UPDATE scheduled_messages SET status = p_status, last_run_at = now() WHERE id = p_id;
  ELSE
    UPDATE scheduled_messages SET last_run_at = now() WHERE id = p_id;
    IF p_status = 'sent' THEN
      DECLARE v_next timestamptz;
      BEGIN
        v_next := CASE v_recurrence
          WHEN 'daily' THEN v_scheduled + interval '1 day'
          WHEN 'weekly' THEN v_scheduled + interval '7 days'
          WHEN 'monthly' THEN v_scheduled + interval '30 days'
        END;
        UPDATE scheduled_messages SET scheduled_for = v_next WHERE id = p_id;
      END;
    ELSE
      UPDATE scheduled_messages SET status = p_status WHERE id = p_id;
    END IF;
  END IF;
END;
$$;
ALTER FUNCTION mark_scheduled_sent(uuid, text) SECURITY DEFINER;
ALTER FUNCTION mark_scheduled_sent(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION mark_scheduled_sent(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_scheduled_sent(uuid, text) TO authenticated;

-- =========================================================
-- 5. Broadcast log functions
-- =========================================================

DROP FUNCTION IF EXISTS log_broadcast(text, text, int, int, int, jsonb);
CREATE FUNCTION log_broadcast(
  p_content text, p_kind text, p_total int, p_succeeded int, p_failed int, p_detail jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO broadcast_logs (user_id, content, kind, total, succeeded, failed, detail)
  VALUES (auth.uid(), p_content, p_kind, p_total, p_succeeded, p_failed, p_detail);
END;
$$;
ALTER FUNCTION log_broadcast(text, text, int, int, int, jsonb) SECURITY DEFINER;
ALTER FUNCTION log_broadcast(text, text, int, int, int, jsonb) SET search_path = public;
REVOKE ALL ON FUNCTION log_broadcast(text, text, int, int, int, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_broadcast(text, text, int, int, int, jsonb) TO authenticated;

DROP FUNCTION IF EXISTS get_broadcast_logs();
CREATE FUNCTION get_broadcast_logs()
RETURNS TABLE (
  id uuid, content text, kind text, total int, succeeded int, failed int, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT bl.id, bl.content, bl.kind, bl.total, bl.succeeded, bl.failed, bl.created_at
  FROM broadcast_logs bl
  WHERE bl.user_id = auth.uid()
  ORDER BY bl.created_at DESC LIMIT 50;
END;
$$;
ALTER FUNCTION get_broadcast_logs() SECURITY DEFINER;
ALTER FUNCTION get_broadcast_logs() SET search_path = public;
REVOKE ALL ON FUNCTION get_broadcast_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_broadcast_logs() TO authenticated;
