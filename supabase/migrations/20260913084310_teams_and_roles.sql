/*
# Teams with Roles

## Summary
Adds team-based organization for webhooks. Users can create teams, invite members,
and assign roles (owner, admin, member). Webhooks can optionally be assigned to a team.

## New Tables
1. `teams` — id, name, description, owner_id (creator), created_at
2. `team_members` — id, team_id, user_id, role (owner/admin/member), created_at

## Modified Tables
- `webhooks` — adds optional `team_id` column (nullable, ON DELETE SET NULL)

## Security
- RLS enabled on both new tables
- teams: owner can CRUD; team members can SELECT
- team_members: team admins/owners can manage; members can SELECT
- All functions are SECURITY DEFINER with search_path = public
*/

-- =========================================================
-- 1. teams table (no policies yet — team_members must exist first)
-- =========================================================
CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_owner_idx ON teams (owner_id);

-- =========================================================
-- 2. team_members table
-- =========================================================
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_members_team_idx ON team_members (team_id);
CREATE INDEX IF NOT EXISTS team_members_user_idx ON team_members (user_id);

-- =========================================================
-- 3. RLS on teams (now that team_members exists)
-- =========================================================
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_teams" ON teams;
CREATE POLICY "select_own_teams" ON teams FOR SELECT
  TO authenticated USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_own_teams" ON teams;
CREATE POLICY "insert_own_teams" ON teams FOR INSERT
  TO authenticated WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "update_own_teams" ON teams;
CREATE POLICY "update_own_teams" ON teams FOR UPDATE
  TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_teams" ON teams;
CREATE POLICY "delete_own_teams" ON teams FOR DELETE
  TO authenticated USING (owner_id = auth.uid());

-- =========================================================
-- 4. RLS on team_members
-- =========================================================
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_team_members" ON team_members;
CREATE POLICY "select_team_members" ON team_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm2 WHERE tm2.team_id = team_members.team_id AND tm2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "insert_team_members" ON team_members;
CREATE POLICY "insert_team_members" ON team_members FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm3 WHERE tm3.team_id = team_id AND tm3.user_id = auth.uid() AND tm3.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_team_members" ON team_members;
CREATE POLICY "update_team_members" ON team_members FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm4 WHERE tm4.team_id = team_members.team_id AND tm4.user_id = auth.uid() AND tm4.role IN ('owner', 'admin')
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm5 WHERE tm5.team_id = team_members.team_id AND tm5.user_id = auth.uid() AND tm5.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_team_members" ON team_members;
CREATE POLICY "delete_team_members" ON team_members FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM teams t WHERE t.id = team_members.team_id AND t.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members tm6 WHERE tm6.team_id = team_members.team_id AND tm6.user_id = auth.uid() AND tm6.role IN ('owner', 'admin')
    )
    OR user_id = auth.uid()
  );

-- =========================================================
-- 5. Add team_id to webhooks
-- =========================================================
DO $$ BEGIN
  ALTER TABLE webhooks ADD COLUMN team_id uuid REFERENCES teams(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS webhooks_team_idx ON webhooks (team_id);

-- =========================================================
-- 6. CRUD functions for teams
-- =========================================================

DROP FUNCTION IF EXISTS get_teams();
CREATE FUNCTION get_teams()
RETURNS TABLE (
  id uuid, name text, description text, owner_id uuid, member_count int, webhook_count int, created_at timestamptz, role text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.description, t.owner_id,
    (SELECT count(*)::int FROM team_members tm WHERE tm.team_id = t.id),
    (SELECT count(*)::int FROM webhooks w WHERE w.team_id = t.id),
    t.created_at,
    COALESCE(
      (SELECT tm.role FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = auth.uid()),
      CASE WHEN t.owner_id = auth.uid() THEN 'owner' ELSE NULL END
    )
  FROM teams t
  WHERE t.owner_id = auth.uid()
     OR EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = t.id AND tm.user_id = auth.uid())
  ORDER BY t.created_at DESC;
END;
$$;
ALTER FUNCTION get_teams() SECURITY DEFINER;
ALTER FUNCTION get_teams() SET search_path = public;
REVOKE ALL ON FUNCTION get_teams() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_teams() TO authenticated;

DROP FUNCTION IF EXISTS create_team(text, text);
CREATE FUNCTION create_team(p_name text, p_description text DEFAULT '')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'Team name is required'; END IF;
  INSERT INTO teams (name, description, owner_id) VALUES (p_name, p_description, auth.uid())
  RETURNING id INTO v_id;
  INSERT INTO team_members (team_id, user_id, role) VALUES (v_id, auth.uid(), 'owner');
  RETURN v_id;
END;
$$;
ALTER FUNCTION create_team(text, text) SECURITY DEFINER;
ALTER FUNCTION create_team(text, text) SET search_path = public;
REVOKE ALL ON FUNCTION create_team(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_team(text, text) TO authenticated;

DROP FUNCTION IF EXISTS update_team(uuid, text, text);
CREATE FUNCTION update_team(p_id uuid, p_name text, p_description text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'Team name is required'; END IF;
  UPDATE teams SET name = p_name, description = p_description
  WHERE id = p_id AND owner_id = auth.uid();
END;
$$;
ALTER FUNCTION update_team(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION update_team(uuid, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION update_team(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_team(uuid, text, text) TO authenticated;

DROP FUNCTION IF EXISTS delete_team(uuid);
CREATE FUNCTION delete_team(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM teams WHERE id = p_id AND owner_id = auth.uid();
END;
$$;
ALTER FUNCTION delete_team(uuid) SECURITY DEFINER;
ALTER FUNCTION delete_team(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION delete_team(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_team(uuid) TO authenticated;

-- =========================================================
-- 7. Team member functions
-- =========================================================

DROP FUNCTION IF EXISTS get_team_members(uuid);
CREATE FUNCTION get_team_members(p_team_id uuid)
RETURNS TABLE (
  id uuid, user_id uuid, email text, role text, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = p_team_id AND t.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT tm.id, tm.user_id, u.email, tm.role, tm.created_at
  FROM team_members tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.team_id = p_team_id
  ORDER BY CASE tm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, tm.created_at;
END;
$$;
ALTER FUNCTION get_team_members(uuid) SECURITY DEFINER;
ALTER FUNCTION get_team_members(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION get_team_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_team_members(uuid) TO authenticated;

DROP FUNCTION IF EXISTS add_team_member(uuid, text, text);
CREATE FUNCTION add_team_member(p_team_id uuid, p_user_email text, p_role text DEFAULT 'member')
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid; v_id uuid;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Role must be admin or member'; END IF;
  IF p_user_email IS NULL OR trim(p_user_email) = '' THEN RAISE EXCEPTION 'Email is required'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = p_team_id AND t.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage this team';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE email = trim(p_user_email);
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found with that email'; END IF;

  INSERT INTO team_members (team_id, user_id, role) VALUES (p_team_id, v_user_id, p_role)
  ON CONFLICT (team_id, user_id) DO UPDATE SET role = p_role
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
ALTER FUNCTION add_team_member(uuid, text, text) SECURITY DEFINER;
ALTER FUNCTION add_team_member(uuid, text, text) SET search_path = public;
REVOKE ALL ON FUNCTION add_team_member(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION add_team_member(uuid, text, text) TO authenticated;

DROP FUNCTION IF EXISTS update_team_member(uuid, text);
CREATE FUNCTION update_team_member(p_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid; v_target_user uuid;
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'Role must be admin or member'; END IF;

  SELECT team_id, user_id INTO v_team_id, v_target_user FROM team_members WHERE id = p_id;
  IF v_team_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = v_team_id AND t.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = v_team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE team_members SET role = p_role WHERE id = p_id AND role != 'owner';
END;
$$;
ALTER FUNCTION update_team_member(uuid, text) SECURITY DEFINER;
ALTER FUNCTION update_team_member(uuid, text) SET search_path = public;
REVOKE ALL ON FUNCTION update_team_member(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_team_member(uuid, text) TO authenticated;

DROP FUNCTION IF EXISTS remove_team_member(uuid);
CREATE FUNCTION remove_team_member(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team_id uuid; v_target_role text;
BEGIN
  SELECT team_id, role INTO v_team_id, v_target_role FROM team_members WHERE id = p_id;
  IF v_team_id IS NULL THEN RAISE EXCEPTION 'Member not found'; END IF;
  IF v_target_role = 'owner' THEN RAISE EXCEPTION 'Cannot remove team owner'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = v_team_id AND t.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = v_team_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  DELETE FROM team_members WHERE id = p_id AND role != 'owner';
END;
$$;
ALTER FUNCTION remove_team_member(uuid) SECURITY DEFINER;
ALTER FUNCTION remove_team_member(uuid) SET search_path = public;
REVOKE ALL ON FUNCTION remove_team_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION remove_team_member(uuid) TO authenticated;

-- =========================================================
-- 8. Assign webhook to team
-- =========================================================
DROP FUNCTION IF EXISTS assign_webhook_to_team(uuid, uuid);
CREATE FUNCTION assign_webhook_to_team(p_webhook_id uuid, p_team_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM webhooks w WHERE w.id = p_webhook_id AND w.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not your webhook';
  END IF;

  IF p_team_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM teams t WHERE t.id = p_team_id AND t.owner_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  UPDATE webhooks SET team_id = p_team_id WHERE id = p_webhook_id AND user_id = auth.uid();
END;
$$;
ALTER FUNCTION assign_webhook_to_team(uuid, uuid) SECURITY DEFINER;
ALTER FUNCTION assign_webhook_to_team(uuid, uuid) SET search_path = public;
REVOKE ALL ON FUNCTION assign_webhook_to_team(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION assign_webhook_to_team(uuid, uuid) TO authenticated;
