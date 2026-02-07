/*
  # Fix WA Intel Security Issues
  
  This migration addresses security and performance issues in the wa_intel schema:
  
  ## 1. Add Missing Foreign Key Indexes
  - Add indexes on all foreign key columns that lack covering indexes
  - Improves join performance and prevents table scans
  
  ## 2. Optimize RLS Policies
  - Replace `auth.uid()` with `(select auth.uid())` in all policies
  - Prevents re-evaluation of auth functions for each row
  - Significantly improves query performance at scale
  
  ## 3. Remove Unused Indexes
  - Drop indexes that haven't been used
  - Reduces storage overhead and improves write performance
  
  ## Important Notes
  - All changes are non-breaking and improve performance
  - RLS security remains intact with optimized evaluation
  - Foreign key constraints are unchanged, only indexes added
*/

-- ============================================================
-- SECTION 1: Add Missing Foreign Key Indexes
-- ============================================================

-- wa_intel.classified_items.message_id
CREATE INDEX IF NOT EXISTS idx_classified_items_message_id 
ON wa_intel.classified_items(message_id);

-- wa_intel.directions.source_message_id
CREATE INDEX IF NOT EXISTS idx_directions_source_message_id 
ON wa_intel.directions(source_message_id);

-- wa_intel.directions.superseded_by
CREATE INDEX IF NOT EXISTS idx_directions_superseded_by 
ON wa_intel.directions(superseded_by);

-- wa_intel.group_members.contact_id
CREATE INDEX IF NOT EXISTS idx_group_members_contact_id 
ON wa_intel.group_members(contact_id);

-- wa_intel.messages.contact_id
CREATE INDEX IF NOT EXISTS idx_messages_contact_id 
ON wa_intel.messages(contact_id);

-- wa_intel.messages.group_id
CREATE INDEX IF NOT EXISTS idx_messages_group_id 
ON wa_intel.messages(group_id);

-- wa_intel.tasks.classified_item_id
CREATE INDEX IF NOT EXISTS idx_tasks_classified_item_id 
ON wa_intel.tasks(classified_item_id);

-- wa_intel.tasks.completion_message_id
CREATE INDEX IF NOT EXISTS idx_tasks_completion_message_id 
ON wa_intel.tasks(completion_message_id);

-- wa_intel.tasks.source_message_id
CREATE INDEX IF NOT EXISTS idx_tasks_source_message_id 
ON wa_intel.tasks(source_message_id);

-- ============================================================
-- SECTION 2: Optimize RLS Policies
-- ============================================================

-- Drop and recreate all wa_intel RLS policies with optimized auth checks

-- wa_intel.groups policies
DROP POLICY IF EXISTS "Authenticated users can view groups" ON wa_intel.groups;
DROP POLICY IF EXISTS "Authenticated users can insert groups" ON wa_intel.groups;
DROP POLICY IF EXISTS "Authenticated users can update groups" ON wa_intel.groups;

CREATE POLICY "Authenticated users can view groups"
  ON wa_intel.groups FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert groups"
  ON wa_intel.groups FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update groups"
  ON wa_intel.groups FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.contacts policies
DROP POLICY IF EXISTS "Authenticated users can view contacts" ON wa_intel.contacts;
DROP POLICY IF EXISTS "Authenticated users can insert contacts" ON wa_intel.contacts;
DROP POLICY IF EXISTS "Authenticated users can update contacts" ON wa_intel.contacts;

CREATE POLICY "Authenticated users can view contacts"
  ON wa_intel.contacts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert contacts"
  ON wa_intel.contacts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts"
  ON wa_intel.contacts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.group_members policies
DROP POLICY IF EXISTS "Authenticated users can view group_members" ON wa_intel.group_members;
DROP POLICY IF EXISTS "Authenticated users can insert group_members" ON wa_intel.group_members;
DROP POLICY IF EXISTS "Authenticated users can update group_members" ON wa_intel.group_members;

CREATE POLICY "Authenticated users can view group_members"
  ON wa_intel.group_members FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert group_members"
  ON wa_intel.group_members FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update group_members"
  ON wa_intel.group_members FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.messages policies
DROP POLICY IF EXISTS "Authenticated users can view messages" ON wa_intel.messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON wa_intel.messages;

CREATE POLICY "Authenticated users can view messages"
  ON wa_intel.messages FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert messages"
  ON wa_intel.messages FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.classified_items policies
DROP POLICY IF EXISTS "Authenticated users can view classified_items" ON wa_intel.classified_items;
DROP POLICY IF EXISTS "Authenticated users can insert classified_items" ON wa_intel.classified_items;
DROP POLICY IF EXISTS "Authenticated users can update classified_items" ON wa_intel.classified_items;

CREATE POLICY "Authenticated users can view classified_items"
  ON wa_intel.classified_items FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert classified_items"
  ON wa_intel.classified_items FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update classified_items"
  ON wa_intel.classified_items FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.tasks policies
DROP POLICY IF EXISTS "Authenticated users can view tasks" ON wa_intel.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON wa_intel.tasks;
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON wa_intel.tasks;

CREATE POLICY "Authenticated users can view tasks"
  ON wa_intel.tasks FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert tasks"
  ON wa_intel.tasks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update tasks"
  ON wa_intel.tasks FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.directions policies
DROP POLICY IF EXISTS "Authenticated users can view directions" ON wa_intel.directions;
DROP POLICY IF EXISTS "Authenticated users can insert directions" ON wa_intel.directions;
DROP POLICY IF EXISTS "Authenticated users can update directions" ON wa_intel.directions;

CREATE POLICY "Authenticated users can view directions"
  ON wa_intel.directions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert directions"
  ON wa_intel.directions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update directions"
  ON wa_intel.directions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- wa_intel.daily_briefings policies
DROP POLICY IF EXISTS "Authenticated users can view daily_briefings" ON wa_intel.daily_briefings;
DROP POLICY IF EXISTS "Authenticated users can insert daily_briefings" ON wa_intel.daily_briefings;

CREATE POLICY "Authenticated users can view daily_briefings"
  ON wa_intel.daily_briefings FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can insert daily_briefings"
  ON wa_intel.daily_briefings FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================
-- SECTION 3: Remove Unused Indexes
-- ============================================================

-- Drop unused indexes in wa_intel schema that aren't being used
DROP INDEX IF EXISTS wa_intel.idx_contacts_location;
DROP INDEX IF EXISTS wa_intel.idx_messages_sender;
DROP INDEX IF EXISTS wa_intel.idx_messages_from_hendra;
DROP INDEX IF EXISTS wa_intel.idx_classified_type;
DROP INDEX IF EXISTS wa_intel.idx_classified_time;
DROP INDEX IF EXISTS wa_intel.idx_tasks_assigned;
DROP INDEX IF EXISTS wa_intel.idx_directions_topic;

-- Drop listener-related indexes that are unused
DROP INDEX IF EXISTS wa_intel.idx_messages_listener_id;
DROP INDEX IF EXISTS wa_intel.idx_groups_listener_id;
DROP INDEX IF EXISTS wa_intel.idx_contacts_listener_id;
