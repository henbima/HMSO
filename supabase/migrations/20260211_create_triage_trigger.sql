-- Spec 202, Task B.1: Create real-time message triage function + trigger
-- Fires on every INSERT into wa_intel.messages
-- Keyword/heuristic-based detection (NO AI, zero cost)
-- Flags: urgent, hendra_instruction, question, low_stock, complaint

CREATE OR REPLACE FUNCTION wa_intel.triage_message()
RETURNS TRIGGER AS $$
DECLARE
    msg_text TEXT;
    msg_lower TEXT;
    is_hendra BOOLEAN;
BEGIN
    msg_text := NEW.message_text;
    IF msg_text IS NULL OR msg_text = '' THEN
        RETURN NEW;
    END IF;

    msg_lower := lower(msg_text);
    is_hendra := COALESCE(NEW.is_from_hendra, false);

    -- Urgent keywords (Bahasa Indonesia + English)
    IF msg_lower ~ '(urgent|darurat|segera|asap|kebakaran|emergency|gawat|bahaya)'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'urgent', 1.0);
    END IF;

    -- Hendra instruction (long message from Hendra = likely direction/task)
    IF is_hendra AND length(msg_text) > 50 THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'hendra_instruction', 0.8);
    END IF;

    -- Question detection (ends with ? or starts with question words)
    IF msg_text ~ '\?\s*$'
       OR msg_lower ~ '^(apa|kapan|dimana|di mana|bagaimana|kenapa|mengapa|siapa|berapa|gimana|mana|bisa|boleh|ada|apakah|bisakah)\s'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'question', 0.9);
    END IF;

    -- Low stock detection
    IF msg_lower ~ '(stok habis|stok kosong|tinggal \d|out of stock|barang habis|persediaan habis|stock habis|stock kosong)'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'low_stock', 0.9);
    END IF;

    -- Complaint detection
    IF msg_lower ~ '(komplain|complaint|marah|kecewa|rusak|expired|cacat|kadaluarsa|kadaluwarsa|basi|busuk)'
    THEN
        INSERT INTO wa_intel.message_flags (message_id, flag_type, confidence)
        VALUES (NEW.id, 'complaint', 0.85);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS trg_triage_message ON wa_intel.messages;

CREATE TRIGGER trg_triage_message
    AFTER INSERT ON wa_intel.messages
    FOR EACH ROW
    EXECUTE FUNCTION wa_intel.triage_message();
