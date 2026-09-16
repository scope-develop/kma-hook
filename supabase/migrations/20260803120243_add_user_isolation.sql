/*
# Add per-user data isolation (multi-tenant)

## Summary
Adds user_id columns to all tables, backfills existing rows, then adds
FK constraints and owner-scoped RLS policies. Each authenticated user
sees only their own data.

## Approach
1. Add user_id as nullable (no FK, no default)
2. Backfill existing rows with a nil UUID placeholder
3. Set NOT NULL + DEFAULT auth.uid()
4. Add FK to auth.users (placeholder is not in auth.users, so we use
   ON DELETE SET NULL approach — but since we need NOT NULL, we instead
   just add the FK without validating existing rows, or we delete old
   rows. Simplest: add FK constraint with NOT VALID so existing rows
   are not checked.)
5. Drop singleton constraints, add per-user unique indexes
6. Replace policies with owner-scoped CRUD
*/

-- =========================================================
-- Step 1: Add user_id columns (nullable, no FK, no default)
-- =========================================================
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE history ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE stats ADD COLUMN IF NOT EXISTS user_id uuid;

-- =========================================================
-- Step 2: Backfill existing rows with nil UUID placeholder
-- =========================================================
UPDATE webhooks SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE templates SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE history SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE settings SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;
UPDATE stats SET user_id = '00000000-0000-0000-0000-000000000000' WHERE user_id IS NULL;

-- =========================================================
-- Step 3: Set NOT NULL + DEFAULT auth.uid()
-- =========================================================
ALTER TABLE webhooks ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE webhooks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE templates ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE templates ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE history ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE history ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE settings ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE settings ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE stats ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE stats ALTER COLUMN user_id SET DEFAULT auth.uid();

-- =========================================================
-- Step 4: Add FK constraints (NOT VALID so existing placeholder rows
-- are not checked against auth.users)
-- =========================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'webhooks_user_id_fkey' AND table_name = 'webhooks'
  ) THEN
    ALTER TABLE webhooks ADD CONSTRAINT webhooks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'templates_user_id_fkey' AND table_name = 'templates'
  ) THEN
    ALTER TABLE templates ADD CONSTRAINT templates_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'history_user_id_fkey' AND table_name = 'history'
  ) THEN
    ALTER TABLE history ADD CONSTRAINT history_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'settings_user_id_fkey' AND table_name = 'settings'
  ) THEN
    ALTER TABLE settings ADD CONSTRAINT settings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'stats_user_id_fkey' AND table_name = 'stats'
  ) THEN
    ALTER TABLE stats ADD CONSTRAINT stats_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- =========================================================
-- Step 5: Drop singleton constraints, add per-user unique indexes
-- =========================================================
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_singleton;
ALTER TABLE stats DROP CONSTRAINT IF EXISTS stats_singleton;

ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
ALTER TABLE stats DROP CONSTRAINT IF EXISTS stats_pkey;

ALTER TABLE settings ADD PRIMARY KEY (id);
ALTER TABLE stats ADD PRIMARY KEY (id);

DROP INDEX IF EXISTS settings_user_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS settings_user_id_idx ON settings (user_id);
DROP INDEX IF EXISTS stats_user_id_idx;
CREATE UNIQUE INDEX IF NOT EXISTS stats_user_id_idx ON stats (user_id);

CREATE INDEX IF NOT EXISTS webhooks_user_id_idx ON webhooks (user_id);
CREATE INDEX IF NOT EXISTS templates_user_id_idx ON templates (user_id);
CREATE INDEX IF NOT EXISTS history_user_id_idx ON history (user_id);

-- =========================================================
-- Step 6: Replace policies with owner-scoped CRUD
-- =========================================================

-- ---- templates ----
DROP POLICY IF EXISTS "anon_select_templates" ON templates;
DROP POLICY IF EXISTS "anon_insert_templates" ON templates;
DROP POLICY IF EXISTS "anon_update_templates" ON templates;
DROP POLICY IF EXISTS "anon_delete_templates" ON templates;

CREATE POLICY "select_own_templates" ON templates FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_templates" ON templates FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_templates" ON templates FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_templates" ON templates FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---- history ----
DROP POLICY IF EXISTS "anon_select_history" ON history;
DROP POLICY IF EXISTS "anon_insert_history" ON history;

CREATE POLICY "select_own_history" ON history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_history" ON history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_history" ON history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_history" ON history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ---- stats ----
DROP POLICY IF EXISTS "anon_select_stats" ON stats;
CREATE POLICY "select_own_stats" ON stats FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

-- ---- settings & webhooks: no direct policies (functions only) ----
