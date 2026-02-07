/*
  # Create wa_intel schema and all core tables

  1. Schema
    - Creates `wa_intel` schema for HollyMart WhatsApp Intelligence system

  2. New Tables
    - `wa_intel.groups` - WhatsApp groups being monitored
      - `id` (uuid, primary key)
      - `wa_group_id` (text, unique) - WhatsApp group JID
      - `name` (text) - Group display name
      - `description` (text) - Group description
      - `is_active` (boolean) - Whether actively monitored
      - `participant_count` (integer)
    - `wa_intel.contacts` - People registry with roles and locations
      - `id` (uuid, primary key)
      - `wa_jid` (text, unique) - WhatsApp JID
      - `phone_number`, `display_name`, `short_name`, `role`, `location`, `department`
      - `is_leadership` (boolean), `is_active` (boolean)
      - `hmcs_employee_id` (text) - Optional link to HMCS
    - `wa_intel.group_members` - Many-to-many group membership
      - Links groups to contacts with WA role tracking
    - `wa_intel.messages` - Raw WhatsApp messages
      - `id` (uuid, primary key)
      - `wa_message_id` (text, unique)
      - Group, sender, contact references
      - `message_text`, `message_type`, `media_url`
      - `is_from_hendra` flag, `quoted_message_id`, `timestamp`
      - `raw_data` (jsonb)
    - `wa_intel.classified_items` - AI classification results
      - Classification type, confidence, summary
      - Extracted entities: assigned_to, assigned_by, deadline, topic, priority
    - `wa_intel.tasks` - Tracked tasks extracted from WA
      - Title, description, assignment, status tracking
      - Status: new / in_progress / done / stuck / cancelled
    - `wa_intel.directions` - Directives from leadership (knowledge base)
      - Title, content, topic, target audience
      - Validity tracking with superseded_by reference
    - `wa_intel.daily_briefings` - Daily briefing log
      - Summary text, counts, delivery tracking

  3. Views
    - `wa_intel.overdue_tasks` - Tasks open > 3 days
    - `wa_intel.today_summary` - Per-group daily summary

  4. Security
    - RLS enabled on all tables
    - Policies for authenticated users to read wa_intel data
    - Service role (Baileys listener) bypasses RLS

  5. Indexes
    - Optimized indexes for common query patterns
*/

CREATE SCHEMA IF NOT EXISTS wa_intel;

-- TABLE 1: groups
CREATE TABLE IF NOT EXISTS wa_intel.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_group_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    participant_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups"
  ON wa_intel.groups FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert groups"
  ON wa_intel.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update groups"
  ON wa_intel.groups FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- TABLE 2: contacts
CREATE TABLE IF NOT EXISTS wa_intel.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_jid TEXT UNIQUE NOT NULL,
    phone_number TEXT,
    display_name TEXT NOT NULL,
    short_name TEXT,
    role TEXT,
    location TEXT,
    department TEXT,
    is_leadership BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    hmcs_employee_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
  ON wa_intel.contacts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contacts"
  ON wa_intel.contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts"
  ON wa_intel.contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_contacts_jid ON wa_intel.contacts(wa_jid);
CREATE INDEX IF NOT EXISTS idx_contacts_location ON wa_intel.contacts(location);

-- TABLE 3: group_members
CREATE TABLE IF NOT EXISTS wa_intel.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES wa_intel.groups(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES wa_intel.contacts(id) ON DELETE CASCADE,
    wa_role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(group_id, contact_id)
);

ALTER TABLE wa_intel.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view group_members"
  ON wa_intel.group_members FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert group_members"
  ON wa_intel.group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update group_members"
  ON wa_intel.group_members FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- TABLE 4: messages
CREATE TABLE IF NOT EXISTS wa_intel.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_message_id TEXT UNIQUE,
    group_id UUID REFERENCES wa_intel.groups(id),
    wa_group_id TEXT NOT NULL,
    sender_jid TEXT NOT NULL,
    sender_name TEXT,
    contact_id UUID REFERENCES wa_intel.contacts(id),
    message_text TEXT,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    is_from_hendra BOOLEAN DEFAULT false,
    quoted_message_id TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages"
  ON wa_intel.messages FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert messages"
  ON wa_intel.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_messages_group_time ON wa_intel.messages(wa_group_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON wa_intel.messages(sender_jid);
CREATE INDEX IF NOT EXISTS idx_messages_from_hendra ON wa_intel.messages(is_from_hendra) WHERE is_from_hendra = true;
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON wa_intel.messages(timestamp DESC);

-- TABLE 5: classified_items
CREATE TABLE IF NOT EXISTS wa_intel.classified_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES wa_intel.messages(id) ON DELETE CASCADE,
    classification TEXT NOT NULL,
    confidence REAL,
    summary TEXT,
    assigned_to TEXT,
    assigned_by TEXT,
    deadline TEXT,
    deadline_parsed TIMESTAMPTZ,
    topic TEXT,
    priority TEXT DEFAULT 'normal',
    ai_model TEXT,
    classified_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.classified_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view classified_items"
  ON wa_intel.classified_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert classified_items"
  ON wa_intel.classified_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update classified_items"
  ON wa_intel.classified_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_classified_type ON wa_intel.classified_items(classification);
CREATE INDEX IF NOT EXISTS idx_classified_time ON wa_intel.classified_items(classified_at DESC);

-- TABLE 6: tasks
CREATE TABLE IF NOT EXISTS wa_intel.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classified_item_id UUID REFERENCES wa_intel.classified_items(id),
    source_message_id UUID REFERENCES wa_intel.messages(id),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    assigned_by TEXT,
    group_name TEXT,
    status TEXT DEFAULT 'new',
    priority TEXT DEFAULT 'normal',
    deadline TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completion_message_id UUID REFERENCES wa_intel.messages(id),
    days_without_response INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks"
  ON wa_intel.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tasks"
  ON wa_intel.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tasks"
  ON wa_intel.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON wa_intel.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON wa_intel.tasks(assigned_to);

-- TABLE 7: directions
CREATE TABLE IF NOT EXISTS wa_intel.directions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_message_id UUID REFERENCES wa_intel.messages(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT,
    group_name TEXT,
    target_audience TEXT,
    is_still_valid BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES wa_intel.directions(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.directions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view directions"
  ON wa_intel.directions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert directions"
  ON wa_intel.directions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update directions"
  ON wa_intel.directions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_directions_topic ON wa_intel.directions(topic);
CREATE INDEX IF NOT EXISTS idx_directions_valid ON wa_intel.directions(is_still_valid) WHERE is_still_valid = true;

-- TABLE 8: daily_briefings
CREATE TABLE IF NOT EXISTS wa_intel.daily_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_date DATE NOT NULL UNIQUE,
    summary_text TEXT NOT NULL,
    new_tasks_count INTEGER DEFAULT 0,
    overdue_tasks_count INTEGER DEFAULT 0,
    completed_tasks_count INTEGER DEFAULT 0,
    new_directions_count INTEGER DEFAULT 0,
    sent_at TIMESTAMPTZ,
    sent_via TEXT DEFAULT 'whatsapp',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE wa_intel.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view daily_briefings"
  ON wa_intel.daily_briefings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert daily_briefings"
  ON wa_intel.daily_briefings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- VIEW: overdue tasks
CREATE OR REPLACE VIEW wa_intel.overdue_tasks AS
SELECT
    t.*,
    m.message_text AS original_message,
    EXTRACT(DAY FROM now() - t.created_at) AS days_open
FROM wa_intel.tasks t
LEFT JOIN wa_intel.messages m ON m.id = t.source_message_id
WHERE t.status NOT IN ('done', 'cancelled')
AND t.created_at < now() - INTERVAL '3 days';

-- VIEW: today summary
CREATE OR REPLACE VIEW wa_intel.today_summary AS
SELECT
    g.name AS group_name,
    g.wa_group_id,
    COUNT(m.id) AS total_messages,
    COUNT(ci.id) FILTER (WHERE ci.classification = 'task') AS task_count,
    COUNT(ci.id) FILTER (WHERE ci.classification = 'direction') AS direction_count,
    COUNT(ci.id) FILTER (WHERE ci.classification = 'report') AS report_count
FROM wa_intel.groups g
LEFT JOIN wa_intel.messages m ON m.wa_group_id = g.wa_group_id
    AND m.timestamp >= CURRENT_DATE
LEFT JOIN wa_intel.classified_items ci ON ci.message_id = m.id
GROUP BY g.name, g.wa_group_id;

-- Grant usage on wa_intel schema to authenticated and anon roles
GRANT USAGE ON SCHEMA wa_intel TO authenticated;
GRANT USAGE ON SCHEMA wa_intel TO anon;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA wa_intel TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA wa_intel TO anon;