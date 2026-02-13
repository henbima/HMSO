-- Spec 202, Task A.2: Create wa_intel.message_flags table
-- Lightweight real-time flags for urgent/important message detection (Layer 1 triage)

CREATE TABLE IF NOT EXISTS wa_intel.message_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES wa_intel.messages(id) ON DELETE CASCADE,
    flag_type TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    resolved_at TIMESTAMPTZ,
    resolved_by_message_id UUID REFERENCES wa_intel.messages(id),
    flagged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_message_flags_type
    ON wa_intel.message_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_message_flags_unresolved
    ON wa_intel.message_flags(flag_type)
    WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_message_flags_message
    ON wa_intel.message_flags(message_id);

-- RLS
ALTER TABLE wa_intel.message_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on message_flags"
    ON wa_intel.message_flags FOR ALL
    TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read message_flags"
    ON wa_intel.message_flags FOR SELECT
    TO authenticated USING (true);

-- Grants
GRANT SELECT ON wa_intel.message_flags TO authenticated;
GRANT ALL ON wa_intel.message_flags TO service_role;
