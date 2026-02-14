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
const BATCH_SIZE = 5;
const MAX_MESSAGES_PER_RUN = 30;
const CONVERSATION_TIMEOUT_MINUTES = 30;
const CONVERSATION_WINDOW_HOURS = 2;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "hmso" },
});

// ─── AI Provider Abstraction ───────────────────────────────────────────────

interface AIProvider {
  readonly modelName: string;
  classify(systemPrompt: string, userPrompt: string): Promise<string>;
}

class OpenAIProvider implements AIProvider {
  readonly modelName: string;
  private apiKey: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.modelName = model;
  }

  async classify(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.modelName,
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

    return content;
  }
}

// Future: class GeminiProvider implements AIProvider { ... }
// Future: class ClaudeProvider implements AIProvider { ... }

function createAIProvider(): AIProvider {
  const provider = Deno.env.get("AI_PROVIDER") || "openai";
  const model = Deno.env.get("AI_MODEL") || "gpt-4o-mini";

  switch (provider) {
    case "openai": {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY not configured");
      }
      return new OpenAIProvider(apiKey, model);
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}. Supported: openai`);
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  wa_message_id: string;
  wa_group_id: string | null;
  sender_jid: string;
  sender_name: string | null;
  message_text: string;
  message_type: string;
  is_from_hendra: boolean;
  quoted_message_id: string | null;
  timestamp: string;
  conversation_type: 'group' | 'personal';
  wa_contact_jid: string | null;
  source_type: string;
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

const SYSTEM_PROMPT = `You are an AI classifier for HollyMart Corp's organizational intelligence system (HMSO). HollyMart is a retail company in Indonesia. Messages are from WhatsApp groups used for daily operations, management, and coordination. Most messages are in Bahasa Indonesia.

You will receive a REPLY THREAD (messages that replied to each other). This is ONE specific topic/conversation that has been separated from other interleaved topics in the same group. Classify this THREAD into EXACTLY ONE category:
- task: An assignment, request, or to-do for someone. Someone is being asked to do something specific.
- direction: A policy, rule, SOP change, or directive from leadership/management that others must follow.
- report: A status update, progress report, sales figure, stock count, or operational data.
- question: Someone asking for information, clarification, or seeking help.
- coordination: Discussions about scheduling, planning, logistics, or operational coordination between team members.
- noise: Casual conversation, greetings, jokes, stickers-only, acknowledgments ("ok", "siap", "noted"), or non-business content.

Return ONE JSON object with:
- classification: MUST be one of: "task", "direction", "report", "question", "coordination", "noise"
- confidence: 0.0 to 1.0 (how certain you are)
- summary: one-line summary of the entire thread in Bahasa Indonesia (max 150 chars)
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
- This thread may span hours or days. Read the ENTIRE thread to understand the complete context.
- Messages marked [REPLY] are replying to earlier messages in this thread.
- Consider the sender's role and position. Messages from leadership (is_leadership=true) are more likely to be tasks or directions.
- Messages from Hendra (the owner) that contain instructions are almost always tasks or directions.
- If the thread is just greetings and acknowledgments ("ok", "siap", "noted"), classify as noise.
- Complaints or issues should be classified as "question" or "task" depending on whether action is requested.
- Return ONLY valid JSON. No markdown, no explanation.`;

const MEETING_SYSTEM_PROMPT = `You are an AI classifier for HollyMart Corp's organizational intelligence system (HMSO). HollyMart is a retail company in Indonesia. You are classifying a MEETING TRANSCRIPT CHUNK — a segment from a recorded meeting (Zoom, in-person, etc.).

Meeting chunks differ from WhatsApp messages:
- They contain structured discussion, not casual chat
- Multiple topics may be discussed within a single chunk
- Decisions carry more weight than in chat messages
- Action items are more explicit and formal

Classify this meeting chunk into EXACTLY ONE primary category:
- task: An action item, assignment, or to-do discussed in the meeting.
- direction: A policy decision, SOP change, or directive agreed upon in the meeting.
- report: A status update, progress report, or data presentation during the meeting.
- question: A question raised that needs follow-up or resolution.
- coordination: Planning, scheduling, or logistics discussed in the meeting.
- noise: Off-topic discussion, small talk, or non-business content.

Return ONE JSON object with:
- classification: MUST be one of: "task", "direction", "report", "question", "coordination", "noise"
- confidence: 0.0 to 1.0 (how certain you are)
- summary: one-line summary of the chunk in Bahasa Indonesia (max 150 chars)
- priority: "low" | "normal" | "high" | "urgent"
  - urgent = needs action within hours (safety, financial loss, leadership direct order)
  - high = needs action today
  - normal = standard business item
  - low = informational, no action needed
- topic: brief topic label in Bahasa Indonesia (max 30 chars)
- assigned_to: person name if a task was assigned (null otherwise)
- assigned_by: person name if a task was assigned (null otherwise)
- deadline: raw deadline text if mentioned (null if none)

IMPORTANT:
- Meeting discussions often contain MULTIPLE action items — classify by the PRIMARY/most important one.
- Decisions made in meetings are more authoritative than chat messages — weight "direction" higher.
- If Hendra (the owner) assigns something in a meeting, it is almost certainly a "task" or "direction".
- Meeting chunks may reference previous meetings or ongoing projects — classify based on what is discussed in THIS chunk.
- Return ONLY valid JSON. No markdown, no explanation.`;

const PERSONAL_SYSTEM_PROMPT = `You are an AI classifier for HollyMart Corp's organizational intelligence system (HMSO). HollyMart is a retail company in Indonesia. These messages are from a PRIVATE/DIRECT conversation with Hendra (the owner). Most messages are in Bahasa Indonesia.

You will receive a direct message thread between Hendra and one contact. This is a 1-on-1 private conversation, NOT a group chat. Classify this conversation into EXACTLY ONE category:
- task: An assignment, request, or to-do for someone. Someone is being asked to do something specific.
- direction: A policy, rule, SOP change, or directive from Hendra that the contact must follow.
- report: A status update, progress report, sales figure, stock count, or operational data.
- question: Someone asking for information, clarification, or seeking help.
- coordination: Discussions about scheduling, planning, logistics, or operational coordination.
- noise: Casual conversation, greetings, jokes, stickers-only, acknowledgments ("ok", "siap", "noted"), or non-business content.

Return ONE JSON object with:
- classification: MUST be one of: "task", "direction", "report", "question", "coordination", "noise"
- confidence: 0.0 to 1.0 (how certain you are)
- summary: one-line summary of the conversation in Bahasa Indonesia (max 150 chars)
- priority: "low" | "normal" | "high" | "urgent"
  - urgent = needs action within hours (safety, financial loss, direct order from Hendra)
  - high = needs action today
  - normal = standard business item
  - low = informational, no action needed
- topic: brief topic label in Bahasa Indonesia (max 30 chars)
- assigned_to: person name if this is a task (null otherwise)
- assigned_by: person name if this is a task (null otherwise)
- deadline: raw deadline text if mentioned, e.g. "besok", "Jumat", "15 Feb" (null if none)

IMPORTANT:
- This is a PRIVATE conversation, so context is more personal and direct than group chats.
- Messages from Hendra (Hendra:YES) that contain instructions are almost always tasks or directions.
- Messages TO Hendra may be reports, questions, or responses to his earlier instructions.
- If the conversation is just greetings and acknowledgments, classify as noise.
- Return ONLY valid JSON. No markdown, no explanation.`;

async function fetchUnclassifiedMessages(): Promise<MessageRow[]> {
  const cutoffTime = new Date();
  cutoffTime.setMinutes(cutoffTime.getMinutes() - CONVERSATION_TIMEOUT_MINUTES);

  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id, wa_message_id, wa_group_id, sender_jid, sender_name,
      message_text, message_type, is_from_hendra, quoted_message_id, timestamp,
      conversation_type, wa_contact_jid, source_type,
      contacts:contact_id(display_name, role, location, department, is_leadership),
      groups:group_id(name),
      classified_items(id)
    `
    )
    .not("message_text", "is", null)
    .neq("message_text", "")
    .lt("timestamp", cutoffTime.toISOString())
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

interface Conversation {
  groupId: string;
  conversationType: 'group' | 'personal';
  messages: MessageRow[];
  startTime: Date;
  endTime: Date;
  threadId: string;
}

function groupMessagesIntoConversations(messages: MessageRow[]): Conversation[] {
  // Separate group and personal messages
  const groupMessages = messages.filter((m) => m.conversation_type !== 'personal');
  const personalMessages = messages.filter((m) => m.conversation_type === 'personal');

  const conversations: Conversation[] = [];

  // --- Group messages: existing thread-based logic ---
  if (groupMessages.length > 0) {
    const messagesByWaId: Map<string, MessageRow> = new Map();
    const threads: Map<string, MessageRow[]> = new Map();
    const processedMessages = new Set<string>();

    for (const msg of groupMessages) {
      messagesByWaId.set(msg.wa_message_id, msg);
    }

    function findThreadRoot(msg: MessageRow): MessageRow {
      let current = msg;
      const visited = new Set<string>();

      while (current.quoted_message_id && !visited.has(current.wa_message_id)) {
        visited.add(current.wa_message_id);
        const parent = messagesByWaId.get(current.quoted_message_id);
        if (!parent) break;
        current = parent;
      }

      return current;
    }

    function collectThread(rootMsg: MessageRow): MessageRow[] {
      const thread: MessageRow[] = [rootMsg];
      const rootId = rootMsg.wa_message_id;

      for (const msg of groupMessages) {
        if (msg.wa_message_id === rootId) continue;

        let current: MessageRow | undefined = msg;
        const visited = new Set<string>();

        while (current && !visited.has(current.wa_message_id)) {
          visited.add(current.wa_message_id);

          if (current.quoted_message_id === rootId) {
            thread.push(msg);
            break;
          }

          current = current.quoted_message_id ? messagesByWaId.get(current.quoted_message_id) : undefined;
        }
      }

      thread.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      return thread;
    }

    for (const msg of groupMessages) {
      if (processedMessages.has(msg.wa_message_id)) continue;

      const root = findThreadRoot(msg);
      const threadId = root.wa_message_id;

      if (!threads.has(threadId)) {
        const threadMessages = collectThread(root);
        threads.set(threadId, threadMessages);

        for (const threadMsg of threadMessages) {
          processedMessages.add(threadMsg.wa_message_id);
        }
      }
    }

    const groupedByChat: Map<string, Map<string, MessageRow[]>> = new Map();

    for (const [threadId, threadMessages] of threads.entries()) {
      const groupId = threadMessages[0].wa_group_id || 'unknown';

      if (!groupedByChat.has(groupId)) {
        groupedByChat.set(groupId, new Map());
      }

      groupedByChat.get(groupId)!.set(threadId, threadMessages);
    }

    for (const [groupId, groupThreads] of groupedByChat.entries()) {
      for (const [threadId, threadMessages] of groupThreads.entries()) {
        const sortedMessages = [...threadMessages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        conversations.push({
          groupId,
          conversationType: 'group',
          messages: sortedMessages,
          startTime: new Date(sortedMessages[0].timestamp),
          endTime: new Date(sortedMessages[sortedMessages.length - 1].timestamp),
          threadId,
        });
      }
    }
  }

  // --- Personal messages: group by wa_contact_jid ---
  if (personalMessages.length > 0) {
    const byContact: Map<string, MessageRow[]> = new Map();

    for (const msg of personalMessages) {
      const contactJid = msg.wa_contact_jid || 'unknown';
      if (!byContact.has(contactJid)) {
        byContact.set(contactJid, []);
      }
      byContact.get(contactJid)!.push(msg);
    }

    for (const [contactJid, contactMessages] of byContact.entries()) {
      const sortedMessages = [...contactMessages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      conversations.push({
        groupId: contactJid,
        conversationType: 'personal',
        messages: sortedMessages,
        startTime: new Date(sortedMessages[0].timestamp),
        endTime: new Date(sortedMessages[sortedMessages.length - 1].timestamp),
        threadId: `personal_${contactJid}`,
      });
    }
  }

  return conversations;
}

function buildConversationPrompt(conversation: Conversation): string {
  const isPersonal = conversation.conversationType === 'personal';
  const duration = Math.round((conversation.endTime.getTime() - conversation.startTime.getTime()) / 60000);

  const messageParts = conversation.messages.map((msg, i) => {
    const contact = msg.contacts;
    const senderName = contact?.display_name || msg.sender_name || msg.sender_jid;
    const role = contact?.role || "unknown";
    const isLeadership = contact?.is_leadership ? "YES" : "no";
    const time = new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const isReply = msg.quoted_message_id ? " [REPLY]" : "";

    return `[${i + 1}] ${time} | ${senderName} (${role}, Lead:${isLeadership}, Hendra:${msg.is_from_hendra ? "YES" : "no"})${isReply}
"${msg.message_text}"`;
  });

  if (isPersonal) {
    const contactName = conversation.messages[0]?.contacts?.display_name
      || conversation.messages[0]?.sender_name
      || conversation.groupId;

    return `This is a PRIVATE/DIRECT conversation between Hendra and "${contactName}" spanning ${duration} minutes with ${conversation.messages.length} messages.

This is a 1-on-1 personal chat, not a group discussion. Classify the overall conversation topic.

${messageParts.join("\n\n")}

Return ONE classification object for this direct conversation.`;
  }

  const groupName = conversation.messages[0]?.groups?.name || conversation.groupId;
  const isMeeting = conversation.messages.some((m) => m.source_type === 'meeting');

  if (isMeeting) {
    return `This is a MEETING TRANSCRIPT CHUNK from "${groupName}" spanning ${duration} minutes with ${conversation.messages.length} segments.

This content comes from a recorded meeting (Zoom/in-person). Classify the PRIMARY topic discussed in this chunk.
Meeting discussions often contain multiple action items — focus on the most important one.

${messageParts.join("\n\n")}

Return ONE classification object for this meeting chunk.`;
  }

  return `This is a REPLY THREAD from WhatsApp group "${groupName}" spanning ${duration} minutes with ${conversation.messages.length} messages.

These messages are all replies to each other (same conversation topic), separated from other interleaved topics in the group.

Classify this SPECIFIC THREAD as ONE unit. Consider the full context and flow.

${messageParts.join("\n\n")}

Return ONE classification object for the entire reply thread.`;
}

async function callAI(
  aiProvider: AIProvider,
  systemPrompt: string,
  userPrompt: string
): Promise<Classification[]> {
  const content = await aiProvider.classify(systemPrompt, userPrompt);

  const parsed = JSON.parse(content);
  const items = parsed.results || parsed.classifications || parsed.items || parsed;

  if (Array.isArray(items)) return items;
  if (Array.isArray(Object.values(parsed)?.[0])) return Object.values(parsed)[0] as Classification[];

  return [parsed];
}

async function saveClassification(
  msg: MessageRow,
  cls: Classification,
  aiProvider: AIProvider
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
      deadline_parsed: cls.deadline ? tryParseDeadline(cls.deadline) : null,
      topic: cls.topic || null,
      priority: cls.priority || "normal",
      ai_model: aiProvider.modelName,
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

async function getLastClassifiedItemId(messageId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("classified_items")
    .select("id")
    .eq("message_id", messageId)
    .order("classified_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Failed to get classified item for message ${messageId}:`, error);
    return null;
  }

  return data?.id || null;
}

async function createTask(
  msg: MessageRow,
  cls: Classification,
  classifiedItemId: string
) {
  const groupName = msg.conversation_type === 'personal'
    ? (msg.contacts?.display_name || msg.sender_name || msg.wa_contact_jid || 'DM')
    : (msg.groups?.name || msg.wa_group_id);

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
  const groupName = msg.conversation_type === 'personal'
    ? (msg.contacts?.display_name || msg.sender_name || msg.wa_contact_jid || 'DM')
    : (msg.groups?.name || msg.wa_group_id);

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
    const aiProvider = createAIProvider();
    console.log(`Using AI provider: ${aiProvider.modelName}`);

    const messages = await fetchUnclassifiedMessages();

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No unclassified messages found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conversations = groupMessagesIntoConversations(messages);
    console.log(`Processing ${messages.length} messages grouped into ${conversations.length} conversations...`);

    let totalProcessed = 0;
    let totalTasks = 0;
    let totalDirections = 0;
    const errors: string[] = [];

    for (const conversation of conversations) {
      const prompt = buildConversationPrompt(conversation);
      const isMeeting = conversation.messages.some((m) => m.source_type === 'meeting');
      const systemPrompt = isMeeting
        ? MEETING_SYSTEM_PROMPT
        : conversation.conversationType === 'personal'
          ? PERSONAL_SYSTEM_PROMPT
          : SYSTEM_PROMPT;

      let classification: Classification;
      try {
        const results = await callAI(aiProvider, systemPrompt, prompt);
        classification = results[0];
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`AI error for conversation in ${conversation.groupId}:`, errMsg);
        errors.push(`Conversation ${conversation.groupId}: ${errMsg}`);
        continue;
      }

      if (!classification || !classification.classification) {
        errors.push(`No classification returned for conversation in ${conversation.groupId}`);
        continue;
      }

      for (const msg of conversation.messages) {
        const classifiedItemId = await saveClassification(msg, classification, aiProvider);
        if (!classifiedItemId) continue;
        totalProcessed++;
      }

      if (classification.classification === "task") {
        const primaryMsg = conversation.messages[conversation.messages.length - 1];
        await createTask(primaryMsg, classification, await getLastClassifiedItemId(primaryMsg.id));
        totalTasks++;
      } else if (classification.classification === "direction") {
        const primaryMsg = conversation.messages[conversation.messages.length - 1];
        await createDirection(primaryMsg, classification);
        totalDirections++;
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
