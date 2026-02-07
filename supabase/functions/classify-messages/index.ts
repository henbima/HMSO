import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;
const AI_MODEL = "gpt-4o-mini";
const BATCH_SIZE = 5;
const MAX_MESSAGES_PER_RUN = 30;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "wa_intel" },
});

interface MessageRow {
  id: string;
  wa_message_id: string;
  wa_group_id: string;
  sender_jid: string;
  sender_name: string | null;
  message_text: string;
  message_type: string;
  is_from_hendra: boolean;
  timestamp: string;
  contacts: {
    display_name: string;
    role: string | null;
    location: string | null;
    department: string | null;
    is_leadership: boolean | null;
  } | null;
  groups: {
    name: string;
  } | null;
  classified_items: { id: string }[];
}

interface Classification {
  index: number;
  classification: string;
  confidence: number;
  summary: string;
  priority: string;
  topic: string;
  assigned_to: string | null;
  assigned_by: string | null;
  deadline: string | null;
}

const SYSTEM_PROMPT = `You are an AI classifier for HollyMart Corp's WhatsApp business intelligence system. HollyMart is a retail company in Indonesia. Messages are from WhatsApp groups used for daily operations, management, and coordination. Most messages are in Bahasa Indonesia.

Classify each message into EXACTLY ONE category:
- task: An assignment, request, or to-do for someone. Someone is being asked to do something specific.
- direction: A policy, rule, SOP change, or directive from leadership/management that others must follow.
- report: A status update, progress report, sales figure, stock count, or operational data.
- question: Someone asking for information, clarification, or seeking help.
- complaint: A complaint, issue report, or problem being raised (broken equipment, customer issue, etc.).
- info: General business information sharing that doesn't fit other categories.
- chitchat: Casual conversation, greetings, jokes, stickers-only context, or non-business content.

For EACH message, return a JSON object with:
- classification: one of the categories above
- confidence: 0.0 to 1.0 (how certain you are)
- summary: one-line summary in Bahasa Indonesia (max 100 chars)
- priority: "low" | "normal" | "high" | "urgent"
  - urgent = needs action within hours (safety, financial loss, leadership direct order)
  - high = needs action today
  - normal = standard business item
  - low = informational, no action needed
- topic: brief topic label in Bahasa Indonesia (max 30 chars)
- assigned_to: person name if this is a task (null otherwise)
- assigned_by: person name if this is a task (null otherwise)
- deadline: raw deadline text if mentioned, e.g. "besok", "Jumat", "15 Feb" (null if none)

IMPORTANT:
- Consider the sender's role and position when classifying. Messages from leadership (is_leadership=true) are more likely to be tasks or directions.
- Messages from Hendra (the owner) that contain instructions are almost always tasks or directions.
- If a message is just a sticker, emoji reaction, or very short greeting like "ok", "siap", "noted" — classify as chitchat.
- Return ONLY valid JSON. No markdown, no explanation.`;

async function fetchUnclassifiedMessages(): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id, wa_message_id, wa_group_id, sender_jid, sender_name,
      message_text, message_type, is_from_hendra, timestamp,
      contacts:contact_id(display_name, role, location, department, is_leadership),
      groups:group_id(name),
      classified_items(id)
    `
    )
    .not("message_text", "is", null)
    .neq("message_text", "")
    .order("timestamp", { ascending: true })
    .limit(MAX_MESSAGES_PER_RUN + 50);

  if (error) {
    throw new Error(`Failed to fetch messages: ${error.message}`);
  }

  const messages = (data as unknown as MessageRow[]) || [];
  return messages
    .filter((m) => !m.classified_items || m.classified_items.length === 0)
    .slice(0, MAX_MESSAGES_PER_RUN);
}

function buildBatchPrompt(batch: MessageRow[]): string {
  const parts = batch.map((msg, i) => {
    const contact = msg.contacts;
    const senderName =
      contact?.display_name || msg.sender_name || msg.sender_jid;
    const role = contact?.role || "unknown";
    const location = contact?.location || "unknown";
    const department = contact?.department || "unknown";
    const isLeadership = contact?.is_leadership ? "YES" : "no";
    const groupName = msg.groups?.name || msg.wa_group_id;

    return `[${i + 1}]
Sender: ${senderName}
Role: ${role} | Dept: ${department} | Location: ${location} | Leadership: ${isLeadership} | Is Hendra: ${msg.is_from_hendra ? "YES" : "no"}
Group: ${groupName}
Time: ${msg.timestamp}
Text: "${msg.message_text}"`;
  });

  return `Classify the following ${batch.length} message(s). Return a JSON array with exactly ${batch.length} object(s), one per message in order.

${parts.join("\n\n")}`;
}

async function callOpenAI(
  systemPrompt: string,
  userPrompt: string
): Promise<Classification[]> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Empty response from OpenAI");
  }

  const parsed = JSON.parse(content);
  const items = parsed.results || parsed.classifications || parsed.items || parsed;

  if (Array.isArray(items)) return items;
  if (Array.isArray(Object.values(parsed)?.[0])) return Object.values(parsed)[0] as Classification[];

  return [parsed];
}

async function saveClassification(
  msg: MessageRow,
  cls: Classification
): Promise<string | null> {
  const { data, error } = await supabase
    .from("classified_items")
    .insert({
      message_id: msg.id,
      classification: cls.classification,
      confidence: cls.confidence,
      summary: cls.summary,
      assigned_to: cls.assigned_to || null,
      assigned_by: cls.assigned_by || null,
      deadline: cls.deadline || null,
      topic: cls.topic || null,
      priority: cls.priority || "normal",
      ai_model: AI_MODEL,
      classified_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`Failed to save classification for ${msg.id}:`, error);
    return null;
  }

  return data?.id || null;
}

async function createTask(
  msg: MessageRow,
  cls: Classification,
  classifiedItemId: string
) {
  const groupName = msg.groups?.name || msg.wa_group_id;

  const { error } = await supabase.from("tasks").insert({
    classified_item_id: classifiedItemId,
    source_message_id: msg.id,
    title: cls.summary || "Untitled task",
    description: msg.message_text,
    assigned_to: cls.assigned_to || null,
    assigned_by:
      cls.assigned_by ||
      msg.contacts?.display_name ||
      msg.sender_name ||
      null,
    group_name: groupName,
    status: "new",
    priority: cls.priority || "normal",
    deadline: cls.deadline ? tryParseDeadline(cls.deadline) : null,
  });

  if (error) {
    console.error(`Failed to create task for message ${msg.id}:`, error);
  }
}

async function createDirection(
  msg: MessageRow,
  cls: Classification
) {
  const groupName = msg.groups?.name || msg.wa_group_id;

  const { error } = await supabase.from("directions").insert({
    source_message_id: msg.id,
    title: cls.summary || "Untitled direction",
    content: msg.message_text,
    topic: cls.topic || null,
    group_name: groupName,
    target_audience: null,
    is_still_valid: true,
  });

  if (error) {
    console.error(`Failed to create direction for message ${msg.id}:`, error);
  }
}

function tryParseDeadline(deadlineText: string): string | null {
  const now = new Date();
  const lower = deadlineText.toLowerCase().trim();

  if (lower === "besok" || lower === "tomorrow") {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  if (lower === "lusa") {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  if (lower === "hari ini" || lower === "today") {
    const d = new Date(now);
    d.setHours(17, 0, 0, 0);
    return d.toISOString();
  }

  const dateMatch = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|okt|oct|nov|des|dec)/i);
  if (dateMatch) {
    const monthMap: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, mei: 4, may: 4, jun: 5,
      jul: 6, aug: 7, agu: 7, sep: 8, okt: 9, oct: 9, nov: 10, des: 11, dec: 11,
    };
    const day = parseInt(dateMatch[1]);
    const month = monthMap[dateMatch[2].toLowerCase()];
    if (month !== undefined) {
      const d = new Date(now.getFullYear(), month, day, 17, 0, 0);
      if (d < now) d.setFullYear(d.getFullYear() + 1);
      return d.toISOString();
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messages = await fetchUnclassifiedMessages();

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unclassified messages found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing ${messages.length} unclassified messages...`);

    let totalProcessed = 0;
    let totalTasks = 0;
    let totalDirections = 0;
    const errors: string[] = [];

    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const prompt = buildBatchPrompt(batch);

      let classifications: Classification[];
      try {
        classifications = await callOpenAI(SYSTEM_PROMPT, prompt);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`OpenAI batch error (offset ${i}):`, errMsg);
        errors.push(`Batch ${i}: ${errMsg}`);
        continue;
      }

      for (let j = 0; j < batch.length; j++) {
        const msg = batch[j];
        const cls = classifications[j];

        if (!cls || !cls.classification) {
          errors.push(`No classification returned for message ${msg.id}`);
          continue;
        }

        const classifiedItemId = await saveClassification(msg, cls);
        if (!classifiedItemId) continue;

        totalProcessed++;

        if (cls.classification === "task") {
          await createTask(msg, cls, classifiedItemId);
          totalTasks++;
        } else if (cls.classification === "direction") {
          await createDirection(msg, cls);
          totalDirections++;
        }
      }
    }

    const result = {
      processed: totalProcessed,
      tasks_created: totalTasks,
      directions_created: totalDirections,
      errors: errors.length > 0 ? errors : undefined,
      remaining: Math.max(0, messages.length - totalProcessed),
    };

    console.log("Classification run complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Classifier error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
