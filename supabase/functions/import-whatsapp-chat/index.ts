import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedMessage {
  timestamp: Date;
  senderName: string;
  text: string;
  rawLine: string;
}

interface ImportRequest {
  chatText: string;
  groupId: string;
  skipClassification?: boolean;
}

interface ImportStats {
  totalParsed: number;
  inserted: number;
  skipped: number;
  errors: number;
  contactMatches: number;
  contactMisses: number;
}

function parseWhatsAppExport(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];
  const lines = text.split('\n');

  const patterns = [
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\]\s*([^:]+?):\s*(.+)$/i,
    /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*([^:]+?):\s*(.+)$/i,
    /^\[(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\]\s*([^:]+?):\s*(.+)$/i,
  ];

  let currentMessage: ParsedMessage | null = null;

  for (const line of lines) {
    if (!line.trim()) continue;

    let matched = false;

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) {
        if (currentMessage) {
          messages.push(currentMessage);
        }

        const [, datePart, timePart, senderName, text] = match;

        const timestamp = parseTimestamp(datePart, timePart);

        currentMessage = {
          timestamp,
          senderName: senderName.trim(),
          text: text.trim(),
          rawLine: line
        };

        matched = true;
        break;
      }
    }

    if (!matched && currentMessage) {
      currentMessage.text += '\n' + line;
    }
  }

  if (currentMessage) {
    messages.push(currentMessage);
  }

  return messages;
}

function parseTimestamp(datePart: string, timePart: string): Date {
  let dateStr = datePart.replace(/\//g, '-');
  const parts = dateStr.split('-');

  if (parts[2].length === 2) {
    const year = parseInt(parts[2]);
    parts[2] = (year > 50 ? '19' : '20') + parts[2];
  }

  let hour = 0, minute = 0, second = 0;
  const timeMatch = timePart.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);

  if (timeMatch) {
    hour = parseInt(timeMatch[1]);
    minute = parseInt(timeMatch[2]);
    second = timeMatch[3] ? parseInt(timeMatch[3]) : 0;

    const meridiem = timeMatch[4]?.toUpperCase();
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
  }

  const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:${second.toString().padStart(2, '0')}Z`;

  return new Date(isoDate);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { chatText, groupId, skipClassification = false }: ImportRequest = await req.json();

    if (!chatText || !groupId) {
      return new Response(
        JSON.stringify({ error: "chatText and groupId are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: group } = await supabase
      .from("wa_intel.groups")
      .select("id, wa_group_id, name")
      .eq("id", groupId)
      .maybeSingle();

    if (!group) {
      return new Response(
        JSON.stringify({ error: "Group not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsedMessages = parseWhatsAppExport(chatText);

    const { data: contacts } = await supabase
      .from("wa_intel.contacts")
      .select("id, display_name, short_name, phone_number");

    const contactMap = new Map<string, string>();
    if (contacts) {
      for (const contact of contacts) {
        const names = [
          contact.display_name?.toLowerCase(),
          contact.short_name?.toLowerCase(),
          contact.phone_number,
        ].filter(Boolean);

        for (const name of names) {
          contactMap.set(name as string, contact.id);
        }
      }
    }

    const stats: ImportStats = {
      totalParsed: parsedMessages.length,
      inserted: 0,
      skipped: 0,
      errors: 0,
      contactMatches: 0,
      contactMisses: 0,
    };

    const messagesToInsert = [];

    for (const msg of parsedMessages) {
      if (msg.text.includes('<Media omitted>') || msg.text.includes('image omitted')) {
        stats.skipped++;
        continue;
      }

      const senderNameLower = msg.senderName.toLowerCase();
      const contactId = contactMap.get(senderNameLower);

      if (contactId) {
        stats.contactMatches++;
      } else {
        stats.contactMisses++;
      }

      const waMessageId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      messagesToInsert.push({
        wa_message_id: waMessageId,
        group_id: group.id,
        wa_group_id: group.wa_group_id,
        sender_jid: `unknown@s.whatsapp.net`,
        sender_name: msg.senderName,
        contact_id: contactId || null,
        message_text: msg.text,
        message_type: 'text',
        timestamp: msg.timestamp.toISOString(),
        raw_data: { imported: true, original_line: msg.rawLine },
      });
    }

    if (messagesToInsert.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < messagesToInsert.length; i += batchSize) {
        const batch = messagesToInsert.slice(i, i + batchSize);

        const { error } = await supabase
          .from("wa_intel.messages")
          .insert(batch);

        if (error) {
          console.error("Insert error:", error);
          stats.errors += batch.length;
        } else {
          stats.inserted += batch.length;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        group: group.name,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );

  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Import failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
