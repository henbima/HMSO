/*
  # Move all WA Intel tables to public schema

  1. Problem
    - Tables were created in custom `wa_intel` schema
    - PostgREST on hosted Supabase does not reliably expose custom schemas
    - All API calls fail with PGRST106 error
    
  2. Solution
    - Recreate all tables in the `public` schema (same structure)
    - All tables have 0 rows so no data migration needed
    
  3. New Tables (all in public schema)
    - `groups` - WhatsApp groups being monitored
    - `contacts` - People registry with roles and locations
    - `group_members` - Many-to-many group membership
    - `messages` - Raw WhatsApp messages
    - `classified_items` - AI classification results
    - `tasks` - Tracked tasks extracted from WA
    - `directions` - Directives from leadership
    - `daily_briefings` - Daily briefing log

  4. Views
    - `overdue_tasks` - Tasks open > 3 days
    - `today_summary` - Per-group daily summary

  5. Security
    - RLS enabled on all tables
    - Policies for authenticated users to read/write
    - Service role bypasses RLS

  6. Indexes
    - Optimized indexes for common query patterns
*/

-- TABLE 1: groups
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_group_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    participant_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view groups"
  ON public.groups FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert groups"
  ON public.groups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update groups"
  ON public.groups FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- TABLE 2: contacts
CREATE TABLE IF NOT EXISTS public.contacts (
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

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contacts"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert contacts"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update contacts"
  ON public.contacts FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pub_contacts_jid ON public.contacts(wa_jid);
CREATE INDEX IF NOT EXISTS idx_pub_contacts_location ON public.contacts(location);

-- TABLE 3: group_members
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
    wa_role TEXT DEFAULT 'member',
    joined_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(group_id, contact_id)
);

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view group_members"
  ON public.group_members FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert group_members"
  ON public.group_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update group_members"
  ON public.group_members FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- TABLE 4: messages
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_message_id TEXT UNIQUE,
    group_id UUID REFERENCES public.groups(id),
    wa_group_id TEXT NOT NULL,
    sender_jid TEXT NOT NULL,
    sender_name TEXT,
    contact_id UUID REFERENCES public.contacts(id),
    message_text TEXT,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    is_from_hendra BOOLEAN DEFAULT false,
    quoted_message_id TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view messages"
  ON public.messages FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pub_messages_group_time ON public.messages(wa_group_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_pub_messages_sender ON public.messages(sender_jid);
CREATE INDEX IF NOT EXISTS idx_pub_messages_from_hendra ON public.messages(is_from_hendra) WHERE is_from_hendra = true;
CREATE INDEX IF NOT EXISTS idx_pub_messages_timestamp ON public.messages(timestamp DESC);

-- TABLE 5: classified_items
CREATE TABLE IF NOT EXISTS public.classified_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
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

ALTER TABLE public.classified_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view classified_items"
  ON public.classified_items FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert classified_items"
  ON public.classified_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update classified_items"
  ON public.classified_items FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pub_classified_type ON public.classified_items(classification);
CREATE INDEX IF NOT EXISTS idx_pub_classified_time ON public.classified_items(classified_at DESC);

-- TABLE 6: tasks
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    classified_item_id UUID REFERENCES public.classified_items(id),
    source_message_id UUID REFERENCES public.messages(id),
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    assigned_by TEXT,
    group_name TEXT,
    status TEXT DEFAULT 'new',
    priority TEXT DEFAULT 'normal',
    deadline TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completion_message_id UUID REFERENCES public.messages(id),
    days_without_response INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pub_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_pub_tasks_assigned ON public.tasks(assigned_to);

-- TABLE 7: directions
CREATE TABLE IF NOT EXISTS public.directions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_message_id UUID REFERENCES public.messages(id),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    topic TEXT,
    group_name TEXT,
    target_audience TEXT,
    is_still_valid BOOLEAN DEFAULT true,
    superseded_by UUID REFERENCES public.directions(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.directions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view directions"
  ON public.directions FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert directions"
  ON public.directions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update directions"
  ON public.directions FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pub_directions_topic ON public.directions(topic);
CREATE INDEX IF NOT EXISTS idx_pub_directions_valid ON public.directions(is_still_valid) WHERE is_still_valid = true;

-- TABLE 8: daily_briefings
CREATE TABLE IF NOT EXISTS public.daily_briefings (
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

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view daily_briefings"
  ON public.daily_briefings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert daily_briefings"
  ON public.daily_briefings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- VIEW: overdue tasks
CREATE OR REPLACE VIEW public.overdue_tasks AS
SELECT
    t.*,
    m.message_text AS original_message,
    EXTRACT(DAY FROM now() - t.created_at) AS days_open
FROM public.tasks t
LEFT JOIN public.messages m ON m.id = t.source_message_id
WHERE t.status NOT IN ('done', 'cancelled')
AND t.created_at < now() - INTERVAL '3 days';

-- VIEW: today summary
CREATE OR REPLACE VIEW public.today_summary AS
SELECT
    g.name AS group_name,
    g.wa_group_id,
    COUNT(m.id) AS total_messages,
    COUNT(ci.id) FILTER (WHERE ci.classification = 'task') AS task_count,
    COUNT(ci.id) FILTER (WHERE ci.classification = 'direction') AS direction_count,
    COUNT(ci.id) FILTER (WHERE ci.classification = 'report') AS report_count
FROM public.groups g
LEFT JOIN public.messages m ON m.wa_group_id = g.wa_group_id
    AND m.timestamp >= CURRENT_DATE
LEFT JOIN public.classified_items ci ON ci.message_id = m.id
GROUP BY g.name, g.wa_group_id;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
