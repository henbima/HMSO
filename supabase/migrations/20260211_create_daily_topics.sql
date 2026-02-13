-- Spec 202, Task A.3: Create wa_intel.daily_topics table
-- One row per identified conversation topic per day per group (Layer 2 classification)

CREATE TABLE IF NOT EXISTS wa_intel.daily_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES wa_intel.groups(id),
    topic_date DATE NOT NULL,
    topic_label TEXT NOT NULL,
    message_ids UUID[] NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    classification TEXT,
    summary TEXT,
    outcome TEXT,
    priority TEXT DEFAULT 'normal',
    action_needed BOOLEAN DEFAULT false,
    assigned_to TEXT,
    assigned_by TEXT,
    deadline TEXT,
    deadline_parsed TIMESTAMPTZ,
    key_participants TEXT[],
    key_decisions TEXT[],
    is_ongoing BOOLEAN DEFAULT false,
    continued_from UUID REFERENCES wa_intel.daily_topics(id),
    ai_model TEXT,
    raw_ai_response JSONB,
    analyzed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_topics_date
    ON wa_intel.daily_topics(topic_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_topics_group_date
    ON wa_intel.daily_topics(group_id, topic_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_topics_class
    ON wa_intel.daily_topics(classification);
CREATE INDEX IF NOT EXISTS idx_daily_topics_ongoing
    ON wa_intel.daily_topics(is_ongoing)
    WHERE is_ongoing = true;
CREATE INDEX IF NOT EXISTS idx_daily_topics_action
    ON wa_intel.daily_topics(action_needed)
    WHERE action_needed = true;

-- RLS
ALTER TABLE wa_intel.daily_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on daily_topics"
    ON wa_intel.daily_topics FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read daily_topics"
    ON wa_intel.daily_topics FOR SELECT
    TO authenticated USING (true);

-- Grants
GRANT SELECT ON wa_intel.daily_topics TO authenticated;
GRANT ALL ON wa_intel.daily_topics TO service_role;
