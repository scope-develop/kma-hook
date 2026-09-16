/*
# Admin Panel Schema — profiles, roles, audit logs, admin settings

## Summary
Adds the database foundation for the KMA TOOLS admin panel:
1. `profiles` table — extends auth.users with role, ban status, and timestamps
2. `audit_logs` table — persistent log of all sensitive admin actions
3. `admin_settings` table — key/value store for admin-configurable app settings
4. SECURITY DEFINER functions for admin operations (all verify caller is admin)
5. Auto-creates a profile row when a new auth user signs up (trigger)
6. Seeds the three specified admin emails as super_admin

## Admin Emails
- dev.scope.core@gmail.com → super_admin
- ianduhamel@icloud.com → super_admin
- ianduhamel45@gmail.com → super_admin

## New Tables
1. `profiles` — id (uuid, PK, FK auth.users), email, role, is_banned, is_disabled, ban_reason, last_sign_in_at, created_at, updated_at
2. `audit_logs` — id, user_id, action, target_user_id, target_type, status, detail, ip, created_at
3. `admin_settings` — key (text PK), value (text), category, updated_at, updated_by

## Security
- RLS enabled on all tables
- `profiles`: users can SELECT their own profile; admins can SELECT all
- `audit_logs`: admins can SELECT all; admin functions INSERT
- `admin_settings`: admins can SELECT; admin functions handle writes
- All admin functions verify `is_admin()` before acting
*/

-- =========================================================
-- 1. profiles table
-- =========================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_banned boolean NOT NULL DEFAULT false,
  is_disabled boolean NOT NULL DEFAULT false,
  ban_reason text,
  last_sign_in_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "select_all_profiles_admin" ON profiles;
CREATE POLICY "select_all_profiles_admin" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

-- =========================================================
-- 2. audit_logs table
-- =========================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type text,
  status text NOT NULL DEFAULT 'success',
  detail text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs_admin" ON audit_logs;
CREATE POLICY "select_audit_logs_admin" ON audit_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

-- =========================================================
-- 3. admin_settings table
-- =========================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_admin_settings_admin" ON admin_settings;
CREATE POLICY "select_admin_settings_admin" ON admin_settings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin'))
  );

-- =========================================================
-- 4. Add is_active and is_default to templates (if missing)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'is_active') THEN
    ALTER TABLE templates ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'templates' AND column_name = 'is_default') THEN
    ALTER TABLE templates ADD COLUMN is_default boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Make templates.user_id nullable for global templates
ALTER TABLE templates ALTER COLUMN user_id DROP NOT NULL;

-- =========================================================
-- 5. is_admin() helper function
-- =========================================================
DROP FUNCTION IF EXISTS is_admin();
CREATE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin') AND p.is_banned = false AND p.is_disabled = false
  );
$$;
ALTER FUNCTION is_admin() SECURITY DEFINER;
ALTER FUNCTION is_admin() SET search_path = public;
REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- =========================================================
-- 6. log_audit() helper — inserts audit log entry
-- =========================================================
DROP FUNCTION IF EXISTS log_audit(text, text, uuid, text);
CREATE FUNCTION log_audit(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_user_id uuid DEFAULT NULL,
  p_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (user_id, action, target_type, target_user_id, detail, status)
  VALUES (auth.uid(), p_action, p_target_type, p_target_user_id, p_detail, 'success');
END;
$$;
ALTER FUNCTION log_audit(text, text, uuid, text) SECURITY DEFINER;
ALTER FUNCTION log_audit(text, text, uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION log_audit(text, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION log_audit(text, text, uuid, text) TO authenticated;

-- =========================================================
-- 7. Admin functions: user management
-- =========================================================

DROP FUNCTION IF EXISTS admin_get_users();
CREATE FUNCTION admin_get_users()
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  is_banned boolean,
  is_disabled boolean,
  ban_reason text,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY SELECT p.id, p.email, p.role, p.is_banned, p.is_disabled, p.ban_reason, p.last_sign_in_at, p.created_at
  FROM profiles p ORDER BY p.created_at DESC;
END;
$$;
ALTER FUNCTION admin_get_users() SECURITY DEFINER;
ALTER FUNCTION admin_get_users() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_users() TO authenticated;

DROP FUNCTION IF EXISTS admin_get_user_details(uuid);
CREATE FUNCTION admin_get_user_details(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  is_banned boolean,
  is_disabled boolean,
  ban_reason text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  webhook_count int,
  messages_sent int,
  embeds_sent int,
  errors int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT
    p.id, p.email, p.role, p.is_banned, p.is_disabled, p.ban_reason,
    p.last_sign_in_at, p.created_at,
    (SELECT count(*) FROM webhooks w WHERE w.user_id = p_user_id)::int,
    COALESCE((SELECT s.messages_sent FROM stats s WHERE s.user_id = p_user_id), 0)::int,
    COALESCE((SELECT s.embeds_sent FROM stats s WHERE s.user_id = p_user_id), 0)::int,
    COALESCE((SELECT s.errors FROM stats s WHERE s.user_id = p_user_id), 0)::int
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$;
ALTER FUNCTION admin_get_user_details(uuid) SECURITY DEFINER;
ALTER FUNCTION admin_get_user_details(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_user_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_user_details(uuid) TO authenticated;

DROP FUNCTION IF EXISTS admin_update_user_role(uuid, text);
CREATE FUNCTION admin_update_user_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF p_role NOT IN ('user', 'admin', 'super_admin') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'super_admin')
     AND NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Only super admins can modify super admin accounts';
  END IF;
  UPDATE profiles SET role = p_role, updated_at = now() WHERE id = p_user_id;
  PERFORM log_audit('ROLE_CHANGE', 'user', p_user_id, 'Role changed to ' || p_role);
END;
$$;
ALTER FUNCTION admin_update_user_role(uuid, text) SECURITY DEFINER;
ALTER FUNCTION admin_update_user_role(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION admin_update_user_role(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_user_role(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS admin_ban_user(uuid, text);
CREATE FUNCTION admin_ban_user(p_user_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot ban yourself'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot ban super admin';
  END IF;
  UPDATE profiles SET is_banned = true, ban_reason = p_reason, updated_at = now() WHERE id = p_user_id;
  PERFORM log_audit('USER_BAN', 'user', p_user_id, p_reason);
END;
$$;
ALTER FUNCTION admin_ban_user(uuid, text) SECURITY DEFINER;
ALTER FUNCTION admin_ban_user(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION admin_ban_user(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_ban_user(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS admin_unban_user(uuid);
CREATE FUNCTION admin_unban_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE profiles SET is_banned = false, ban_reason = NULL, updated_at = now() WHERE id = p_user_id;
  PERFORM log_audit('USER_UNBAN', 'user', p_user_id, NULL);
END;
$$;
ALTER FUNCTION admin_unban_user(uuid) SECURITY DEFINER;
ALTER FUNCTION admin_unban_user(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION admin_unban_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_unban_user(uuid) TO authenticated;

DROP FUNCTION IF EXISTS admin_set_user_disabled(uuid, boolean);
CREATE FUNCTION admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot disable yourself'; END IF;
  UPDATE profiles SET is_disabled = p_disabled, updated_at = now() WHERE id = p_user_id;
  PERFORM log_audit(CASE WHEN p_disabled THEN 'USER_DISABLE' ELSE 'USER_ENABLE' END, 'user', p_user_id, NULL);
END;
$$;
ALTER FUNCTION admin_set_user_disabled(uuid, boolean) SECURITY DEFINER;
ALTER FUNCTION admin_set_user_disabled(uuid, boolean) SET search_path = public;
REVOKE ALL ON FUNCTION admin_set_user_disabled(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_set_user_disabled(uuid, boolean) TO authenticated;

DROP FUNCTION IF EXISTS admin_delete_user(uuid);
CREATE FUNCTION admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot delete yourself'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete super admin';
  END IF;
  PERFORM log_audit('USER_DELETE', 'user', p_user_id, 'User deleted by admin');
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;
ALTER FUNCTION admin_delete_user(uuid) SECURITY DEFINER;
ALTER FUNCTION admin_delete_user(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION admin_delete_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_user(uuid) TO authenticated;

-- =========================================================
-- 8. Admin functions: webhook management
-- =========================================================

DROP FUNCTION IF EXISTS admin_get_all_webhooks();
CREATE FUNCTION admin_get_all_webhooks()
RETURNS TABLE (
  id uuid,
  name text,
  owner_email text,
  owner_id uuid,
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
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT w.id, w.name, p.email, w.user_id, w.is_active, w.status,
         w.last_http_status, w.last_latency_ms, w.last_tested_at, w.created_at
  FROM webhooks w
  JOIN profiles p ON p.id = w.user_id
  ORDER BY w.created_at DESC;
END;
$$;
ALTER FUNCTION admin_get_all_webhooks() SECURITY DEFINER;
ALTER FUNCTION admin_get_all_webhooks() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_all_webhooks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_all_webhooks() TO authenticated;

DROP FUNCTION IF EXISTS admin_delete_webhook(uuid);
CREATE FUNCTION admin_delete_webhook(p_webhook_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_owner_id uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  SELECT user_id INTO v_owner_id FROM webhooks WHERE id = p_webhook_id;
  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'Webhook not found'; END IF;
  DELETE FROM webhooks WHERE id = p_webhook_id;
  PERFORM log_audit('WEBHOOK_DELETE', 'webhook', NULL::uuid, 'Deleted webhook ' || p_webhook_id::text || ' owned by ' || v_owner_id::text);
END;
$$;
ALTER FUNCTION admin_delete_webhook(uuid) SECURITY DEFINER;
ALTER FUNCTION admin_delete_webhook(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION admin_delete_webhook(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_webhook(uuid) TO authenticated;

-- =========================================================
-- 9. Admin functions: template management
-- =========================================================

DROP FUNCTION IF EXISTS admin_get_all_templates();
CREATE FUNCTION admin_get_all_templates()
RETURNS TABLE (
  id uuid,
  name text,
  kind text,
  owner_email text,
  owner_id uuid,
  is_global boolean,
  is_active boolean,
  is_default boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT t.id, t.name, t.kind,
         COALESCE(p.email, 'GLOBAL'), t.user_id,
         t.user_id IS NULL AS is_global,
         t.is_active, t.is_default,
         t.created_at
  FROM templates t
  LEFT JOIN profiles p ON p.id = t.user_id
  ORDER BY t.created_at DESC;
END;
$$;
ALTER FUNCTION admin_get_all_templates() SECURITY DEFINER;
ALTER FUNCTION admin_get_all_templates() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_all_templates() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_all_templates() TO authenticated;

DROP FUNCTION IF EXISTS admin_create_template(text, text, jsonb);
CREATE FUNCTION admin_create_template(p_name text, p_kind text, p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO templates (name, kind, payload, user_id)
  VALUES (p_name, p_kind, p_payload, NULL)
  RETURNING id INTO v_id;
  PERFORM log_audit('TEMPLATE_CREATE', 'template', NULL::uuid, 'Created global template ' || p_name);
  RETURN v_id;
END;
$$;
ALTER FUNCTION admin_create_template(text, text, jsonb) SECURITY DEFINER;
ALTER FUNCTION admin_create_template(text, text, jsonb) SET search_path = public;
REVOKE ALL ON FUNCTION admin_create_template(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_create_template(text, text, jsonb) TO authenticated;

DROP FUNCTION IF EXISTS admin_update_template(uuid, text, text, jsonb, boolean, boolean);
CREATE FUNCTION admin_update_template(
  p_id uuid, p_name text, p_kind text, p_payload jsonb,
  p_is_active boolean, p_is_default boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  UPDATE templates SET
    name = p_name, kind = p_kind, payload = p_payload,
    is_active = p_is_active, is_default = p_is_default,
    updated_at = now()
  WHERE id = p_id;
  PERFORM log_audit('TEMPLATE_UPDATE', 'template', NULL::uuid, 'Updated template ' || p_name);
END;
$$;
ALTER FUNCTION admin_update_template(uuid, text, text, jsonb, boolean, boolean) SECURITY DEFINER;
ALTER FUNCTION admin_update_template(uuid, text, text, jsonb, boolean, boolean) SET search_path = public;
REVOKE ALL ON FUNCTION admin_update_template(uuid, text, text, jsonb, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_template(uuid, text, text, jsonb, boolean, boolean) TO authenticated;

DROP FUNCTION IF EXISTS admin_delete_template(uuid);
CREATE FUNCTION admin_delete_template(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  DELETE FROM templates WHERE id = p_id;
  PERFORM log_audit('TEMPLATE_DELETE', 'template', NULL::uuid, 'Deleted template ' || p_id::text);
END;
$$;
ALTER FUNCTION admin_delete_template(uuid) SECURITY DEFINER;
ALTER FUNCTION admin_delete_template(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION admin_delete_template(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_template(uuid) TO authenticated;

-- =========================================================
-- 10. Admin functions: analytics & audit logs
-- =========================================================

DROP FUNCTION IF EXISTS admin_get_global_stats();
CREATE FUNCTION admin_get_global_stats()
RETURNS TABLE (
  total_users bigint,
  total_webhooks bigint,
  total_messages bigint,
  total_embeds bigint,
  total_errors bigint,
  total_templates bigint,
  banned_users bigint,
  disabled_users bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM profiles)::bigint,
    (SELECT count(*) FROM webhooks)::bigint,
    (SELECT COALESCE(sum(messages_sent), 0) FROM stats)::bigint,
    (SELECT COALESCE(sum(embeds_sent), 0) FROM stats)::bigint,
    (SELECT COALESCE(sum(errors), 0) FROM stats)::bigint,
    (SELECT count(*) FROM templates)::bigint,
    (SELECT count(*) FROM profiles WHERE is_banned)::bigint,
    (SELECT count(*) FROM profiles WHERE is_disabled)::bigint;
END;
$$;
ALTER FUNCTION admin_get_global_stats() SECURITY DEFINER;
ALTER FUNCTION admin_get_global_stats() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_global_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_global_stats() TO authenticated;

DROP FUNCTION IF EXISTS admin_get_all_history();
CREATE FUNCTION admin_get_all_history()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  action text,
  content text,
  status text,
  detail text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT h.id, h.user_id, p.email, h.action, h.content, h.status, h.detail, h.created_at
  FROM history h
  LEFT JOIN profiles p ON p.id = h.user_id
  ORDER BY h.created_at DESC
  LIMIT 500;
END;
$$;
ALTER FUNCTION admin_get_all_history() SECURITY DEFINER;
ALTER FUNCTION admin_get_all_history() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_all_history() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_all_history() TO authenticated;

DROP FUNCTION IF EXISTS admin_get_audit_logs();
CREATE FUNCTION admin_get_audit_logs()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  user_email text,
  action text,
  target_type text,
  target_user_id uuid,
  status text,
  detail text,
  ip text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY
  SELECT a.id, a.user_id, p.email, a.action, a.target_type, a.target_user_id,
         a.status, a.detail, a.ip, a.created_at
  FROM audit_logs a
  LEFT JOIN profiles p ON p.id = a.user_id
  ORDER BY a.created_at DESC
  LIMIT 500;
END;
$$;
ALTER FUNCTION admin_get_audit_logs() SECURITY DEFINER;
ALTER FUNCTION admin_get_audit_logs() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_audit_logs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_audit_logs() TO authenticated;

-- =========================================================
-- 11. Admin settings functions
-- =========================================================

DROP FUNCTION IF EXISTS admin_get_settings();
CREATE FUNCTION admin_get_settings()
RETURNS TABLE (key text, value text, category text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN QUERY SELECT s.key, s.value, s.category FROM admin_settings s ORDER BY s.category, s.key;
END;
$$;
ALTER FUNCTION admin_get_settings() SECURITY DEFINER;
ALTER FUNCTION admin_get_settings() SET search_path = public;
REVOKE ALL ON FUNCTION admin_get_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_get_settings() TO authenticated;

DROP FUNCTION IF EXISTS admin_save_setting(text, text, text);
CREATE FUNCTION admin_save_setting(p_key text, p_value text, p_category text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  INSERT INTO admin_settings (key, value, category, updated_at, updated_by)
  VALUES (p_key, p_value, p_category, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, category = EXCLUDED.category, updated_at = now(), updated_by = auth.uid();
  PERFORM log_audit('SETTING_CHANGE', 'setting', NULL::uuid, 'Updated setting: ' || p_key);
END;
$$;
ALTER FUNCTION admin_save_setting(text, text, text) SECURITY DEFINER;
ALTER FUNCTION admin_save_setting(text, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION admin_save_setting(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_save_setting(text, text, text) TO authenticated;

-- =========================================================
-- 12. Trigger: auto-create profile on signup
-- =========================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
ALTER FUNCTION handle_new_user() SECURITY DEFINER;
ALTER FUNCTION handle_new_user() SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =========================================================
-- 13. Seed admin emails as super_admin
-- =========================================================
INSERT INTO profiles (id, email, role)
SELECT id, email, 'super_admin'
FROM auth.users
WHERE email IN (
  'dev.scope.core@gmail.com',
  'ianduhamel@icloud.com',
  'ianduhamel45@gmail.com'
)
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', updated_at = now();

-- =========================================================
-- 14. Seed default admin settings
-- =========================================================
INSERT INTO admin_settings (key, value, category) VALUES
  ('app_name', 'KMA TOOLS', 'general'),
  ('app_version', 'v6.0', 'general'),
  ('app_description', 'Discord Webhook Management Suite', 'general'),
  ('allow_signups', 'true', 'users'),
  ('allow_new_users', 'true', 'users'),
  ('webhook_limit', '10', 'webhooks'),
  ('send_limit', '50', 'webhooks'),
  ('webhooks_enabled', 'true', 'webhooks'),
  ('session_timeout', '60', 'security'),
  ('rate_limiting', 'true', 'security'),
  ('maintenance_mode', 'false', 'maintenance'),
  ('maintenance_message', 'System under maintenance. Please check back soon.', 'maintenance')
ON CONFLICT (key) DO NOTHING;
