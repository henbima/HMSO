-- Spec 202, Task A.4: Add topic-based columns to wa_intel.daily_briefings

ALTER TABLE wa_intel.daily_briefings
    ADD COLUMN IF NOT EXISTS topics_analyzed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS groups_analyzed INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ongoing_topics_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS raw_analysis JSONB;
