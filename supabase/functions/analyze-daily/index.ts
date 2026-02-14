import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ─── Configuration ────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_MESSAGES_PER_WINDOW = 150;
const MIN_MESSAGES_FOR_SEGMENTATION = 3;
const BATCH_SIZE = 5; // Process max 5 groups per invocation to avoid timeout
const WIB_OFFSET_HOURS = 7; // UTC+7

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "hmso" },
});

// ─── AI Provider Abstraction (reused from classify-messages) ──────────────

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


// ─── Types ────────────────────────────────────────────────────────────────

interface MessageRow {
  id: string;
  wa_message_id: string;
  wa_group_id: string;
  sender_jid: string;
  sender_name: string | null;
  message_text: string;
  message_type: string;
  is_from_hendra: boolean;
  quoted_message_id: string | null;
  timestamp: string;
  contacts: {
    display_name: string;
    role: string | null;
    location: string | null;
    department: string | null;
    is_leadership: boolean | null;
  } | null;
}

interface ActiveGroup {
  id: string;
  name: string;
  wa_group_id: string;
  message_count: number;
}

interface SegmentedTopic {
  topic_id: number;
  label: string;
  message_indices: number[];
  key_participants: string[];
  timespan_start: string;
  timespan_end: string;
}

interface SegmentationResult {
  topics: SegmentedTopic[];
  noise_indices: number[];
}

interface TopicClassification {
  classification: string;
  confidence: number;
  summary: string;
  outcome: string;
  priority: string;
  action_needed: boolean;
  assigned_to: string | null;
  assigned_by: string | null;
  deadline: string | null;
  key_decisions: string[];
}

// ─── Date Utilities ───────────────────────────────────────────────────────

function getAnalysisDateRange(overrideDate?: string): {
  startUtc: string;
  endUtc: string;
  dateStr: string;
} {
  if (overrideDate) {
    const start = new Date(`${overrideDate}T00:00:00+07:00`);
    const end = new Date(`${overrideDate}T23:59:59.999+07:00`);
    return {
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      dateStr: overrideDate,
    };
  }

  const nowUtc = new Date();
  const nowWib = new Date(nowUtc.getTime() + WIB_OFFSET_HOURS * 60 * 60 * 1000);

  const yesterday = new Date(nowWib);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateStr = yesterday.toISOString().split("T")[0];

  const start = new Date(`${dateStr}T00:00:00+07:00`);
  const end = new Date(`${dateStr}T23:59:59.999+07:00`);

  return {
    startUtc: start.toISOString(),
    endUtc: end.toISOString(),
    dateStr,
  };
}

// ─── Data Fetching (FIXED: use wa_group_id for resilient joins) ───────────

async function getActiveGroupsWithMessages(
  startUtc: string,
  endUtc: string
): Promise<ActiveGroup[]> {
  // Query distinct wa_group_ids from messages in the date range,
  // then look up group records by wa_group_id.
  // This is resilient to group_id being NULL on messages.
  const { data: msgData, error: msgError } = await supabase
    .from("messages")
    .select("wa_group_id")
    .gte("timestamp", startUtc)
    .lte("timestamp", endUtc)
    .not("message_text", "is", null)
    .neq("message_text", "")
    .not("wa_group_id", "is", null);

  if (msgError) {
    throw new Error(`Failed to fetch messages: ${msgError.message}`);
  }

  if (!msgData || msgData.length === 0) return [];

  // Count messages per wa_group_id
  const countMap = new Map<string, number>();
  for (const row of msgData) {
    const wgid = (row as { wa_group_id: string }).wa_group_id;
    countMap.set(wgid, (countMap.get(wgid) || 0) + 1);
  }

  // Look up group records for these wa_group_ids
  const waGroupIds = Array.from(countMap.keys());
  const { data: groupData, error: groupError } = await supabase
    .from("groups")
    .select("id, name, wa_group_id")
    .in("wa_group_id", waGroupIds);

  if (groupError) {
    throw new Error(`Failed to fetch groups: ${groupError.message}`);
  }

  const activeGroups: ActiveGroup[] = [];
  for (const g of groupData || []) {
    const group = g as { id: string; name: string; wa_group_id: string };
    const msgCount = countMap.get(group.wa_group_id) || 0;
    if (msgCount > 0) {
      activeGroups.push({
        id: group.id,
        name: group.name,
        wa_group_id: group.wa_group_id,
        message_count: msgCount,
      });
    }
  }

  return activeGroups.sort((a, b) => b.message_count - a.message_count);
}

async function getGroupMessages(
  waGroupId: string,
  startUtc: string,
  endUtc: string
): Promise<MessageRow[]> {
  // FIXED: filter by wa_group_id instead of group_id (UUID FK)
  // This works even when group_id is NULL on messages
  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id, wa_message_id, wa_group_id, sender_jid, sender_name,
      message_text, message_type, is_from_hendra, quoted_message_id, timestamp,
      contacts:contact_id(display_name, role, location, department, is_leadership)
    `
    )
    .eq("wa_group_id", waGroupId)
    .gte("timestamp", startUtc)
    .lte("timestamp", endUtc)
    .not("message_text", "is", null)
    .neq("message_text", "")
    .order("timestamp", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch messages for group ${waGroupId}: ${error.message}`);
  }

  return (data as unknown as MessageRow[]) || [];
}


// ─── Window Splitting ─────────────────────────────────────────────────────

function splitIntoWindows(
  messages: MessageRow[],
  maxPerWindow: number
): MessageRow[][] {
  if (messages.length <= maxPerWindow) return [messages];

  const windowCount = Math.ceil(messages.length / maxPerWindow);
  const windowSize = Math.ceil(messages.length / windowCount);

  const windows: MessageRow[][] = [];
  for (let i = 0; i < messages.length; i += windowSize) {
    windows.push(messages.slice(i, i + windowSize));
  }
  return windows;
}

// ─── AI Prompts ───────────────────────────────────────────────────────────

const SEGMENTATION_SYSTEM_PROMPT = `You are an AI analyst for HollyMart Corp's organizational intelligence system (HMSO). HollyMart is a retail company in Indonesia with multiple stores. Messages are from WhatsApp groups used for daily operations, management, and coordination. Most messages are in Bahasa Indonesia.

Your job is to identify distinct conversation TOPICS within a day's worth of messages from a single WhatsApp group. Messages that are about the same subject should be grouped together, even if they don't use WhatsApp's reply feature.

Rules:
- Group messages that discuss the SAME subject into one topic
- Messages DON'T need WhatsApp reply threading to be related — use content, timing, participants, and context
- A response hours later IS part of the same topic if it clearly relates to an earlier message
- Short acknowledgments ("ok", "siap", "noted", "baik") belong to the topic they respond to — use timing and context to determine which topic
- A single standalone message can be its own topic
- Consider sender roles: a Store Manager reporting stock is likely a different topic than the CEO assigning a task
- Messages that are purely greetings, stickers, or completely off-topic go to noise_indices

Return ONLY valid JSON. No markdown, no explanation.`;

const CLASSIFICATION_SYSTEM_PROMPT = `You are an AI classifier for HollyMart Corp's organizational intelligence system (HMSO). HollyMart is a retail company in Indonesia with multiple stores.

You will receive a COMPLETE conversation topic — all messages related to one subject, extracted from a WhatsApp group. You have the full conversation arc from start to finish.

Classify this topic into ONE category:
- task: Someone assigned work to someone. Include who assigned, who must do it, deadline if mentioned.
- direction: A policy, rule, SOP change, or directive from leadership that others must follow.
- report: A status update, progress report, sales figure, stock count, or operational data.
- question: Someone asking for information or seeking help. Note if it was answered.
- coordination: Scheduling, planning, logistics, or operational coordination.
- noise: Casual conversation, greetings, stickers, non-business content.

For "outcome", choose one:
- completed: Task/request was fulfilled in this conversation
- pending: Task/request was acknowledged but not yet done
- answered: Question was asked and answered
- ongoing: Discussion is still open, no resolution yet
- no_action_needed: Informational, no follow-up required

Return ONLY valid JSON. No markdown, no explanation.`;

function buildSegmentationPrompt(
  groupName: string,
  date: string,
  messages: MessageRow[]
): string {
  const formattedMessages = messages.map((msg, i) => {
    const contact = msg.contacts;
    const senderName = contact?.display_name || msg.sender_name || msg.sender_jid;
    const role = contact?.role || "unknown";
    const isLeadership = contact?.is_leadership ? "YES" : "no";
    const time = new Date(msg.timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });
    const isReply = msg.quoted_message_id ? " [REPLY]" : "";

    return `[${i + 1}] ${time} | ${senderName} (${role}, Lead:${isLeadership})${isReply}\n"${msg.message_text}"`;
  });

  return `Analyze this full day of WhatsApp messages from HollyMart group.

Group: "${groupName}"
Date: ${date}
Total messages: ${messages.length}

Messages (numbered sequentially):

${formattedMessages.join("\n\n")}

Identify distinct conversation TOPICS. Return JSON:
{
  "topics": [
    {
      "topic_id": 1,
      "label": "short descriptive label in Bahasa Indonesia (max 40 chars)",
      "message_indices": [1, 2, 7, 12],
      "key_participants": ["Hendra", "Andi"],
      "timespan_start": "08:02",
      "timespan_end": "09:45"
    }
  ],
  "noise_indices": [5, 8]
}`;
}

function buildClassificationPrompt(
  groupName: string,
  topicLabel: string,
  date: string,
  messages: MessageRow[],
  keyParticipants: string[]
): string {
  const participantsWithRoles = messages
    .reduce((acc: string[], msg) => {
      const contact = msg.contacts;
      const name = contact?.display_name || msg.sender_name || msg.sender_jid;
      const role = contact?.role || "unknown";
      const isLeadership = contact?.is_leadership ? ", Leadership" : "";
      const desc = `${name} (${role}${isLeadership})`;
      if (!acc.includes(desc)) acc.push(desc);
      return acc;
    }, [])
    .join(", ");

  const formattedMessages = messages.map((msg, i) => {
    const contact = msg.contacts;
    const senderName = contact?.display_name || msg.sender_name || msg.sender_jid;
    const time = new Date(msg.timestamp).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Makassar",
    });
    const isHendra = msg.is_from_hendra ? " [HENDRA/OWNER]" : "";

    return `[${i + 1}] ${time} | ${senderName}${isHendra}\n"${msg.message_text}"`;
  });

  return `Classify this complete conversation topic from HollyMart WhatsApp group.

Group: "${groupName}"
Topic: "${topicLabel}"
Date: ${date}
Participants: ${participantsWithRoles}

Complete conversation (all messages, chronologically):

${formattedMessages.join("\n\n")}

Return JSON:
{
  "classification": "task",
  "confidence": 0.95,
  "summary": "1-2 sentence summary of the conversation arc in Bahasa Indonesia",
  "outcome": "completed|pending|answered|ongoing|no_action_needed",
  "priority": "urgent|high|normal|low",
  "action_needed": true,
  "assigned_to": "Name" or null,
  "assigned_by": "Name" or null,
  "deadline": "raw deadline text" or null,
  "key_decisions": ["Decision 1"] or []
}`;
}


// ─── AI Calls ─────────────────────────────────────────────────────────────

async function segmentTopics(
  aiProvider: AIProvider,
  groupName: string,
  date: string,
  messages: MessageRow[]
): Promise<SegmentationResult> {
  const prompt = buildSegmentationPrompt(groupName, date, messages);
  const content = await aiProvider.classify(SEGMENTATION_SYSTEM_PROMPT, prompt);

  const parsed = JSON.parse(content);

  return {
    topics: parsed.topics || [],
    noise_indices: parsed.noise_indices || [],
  };
}

async function classifyTopic(
  aiProvider: AIProvider,
  groupName: string,
  topicLabel: string,
  date: string,
  topicMessages: MessageRow[],
  keyParticipants: string[]
): Promise<TopicClassification> {
  const prompt = buildClassificationPrompt(
    groupName,
    topicLabel,
    date,
    topicMessages,
    keyParticipants
  );
  const content = await aiProvider.classify(CLASSIFICATION_SYSTEM_PROMPT, prompt);

  const parsed = JSON.parse(content);

  return {
    classification: parsed.classification || "noise",
    confidence: parsed.confidence || 0.5,
    summary: parsed.summary || "",
    outcome: parsed.outcome || "no_action_needed",
    priority: parsed.priority || "normal",
    action_needed: parsed.action_needed || false,
    assigned_to: parsed.assigned_to || null,
    assigned_by: parsed.assigned_by || null,
    deadline: parsed.deadline || null,
    key_decisions: parsed.key_decisions || [],
  };
}

// ─── Saving Results ───────────────────────────────────────────────────────

async function saveDailyTopic(
  groupId: string,
  dateStr: string,
  topic: SegmentedTopic,
  classification: TopicClassification,
  _messages: MessageRow[],
  topicMessages: MessageRow[],
  aiModel: string,
  rawAiResponse: object
): Promise<string | null> {
  const messageIds = topicMessages.map((m) => m.id);

  const { data, error } = await supabase
    .from("daily_topics")
    .insert({
      group_id: groupId,
      topic_date: dateStr,
      topic_label: topic.label,
      message_ids: messageIds,
      message_count: messageIds.length,
      classification: classification.classification,
      summary: classification.summary,
      outcome: classification.outcome,
      priority: classification.priority,
      action_needed: classification.action_needed,
      assigned_to: classification.assigned_to,
      assigned_by: classification.assigned_by,
      deadline: classification.deadline,
      deadline_parsed: classification.deadline
        ? tryParseDeadline(classification.deadline)
        : null,
      key_participants: topic.key_participants,
      key_decisions: classification.key_decisions,
      is_ongoing: classification.outcome === "ongoing" || classification.outcome === "pending",
      ai_model: aiModel,
      raw_ai_response: rawAiResponse,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(`Failed to save daily topic "${topic.label}":`, error);
    return null;
  }

  return data?.id || null;
}

async function saveNoiseTopic(
  groupId: string,
  dateStr: string,
  noiseMessages: MessageRow[],
  aiModel: string
): Promise<void> {
  if (noiseMessages.length === 0) return;

  const messageIds = noiseMessages.map((m) => m.id);

  const { error } = await supabase.from("daily_topics").insert({
    group_id: groupId,
    topic_date: dateStr,
    topic_label: "Pesan umum / noise",
    message_ids: messageIds,
    message_count: messageIds.length,
    classification: "noise",
    summary: `${messageIds.length} pesan non-bisnis (salam, stiker, chat ringan)`,
    outcome: "no_action_needed",
    priority: "low",
    action_needed: false,
    key_participants: [],
    key_decisions: [],
    is_ongoing: false,
    ai_model: aiModel,
    raw_ai_response: {},
  });

  if (error) {
    console.error("Failed to save noise topic:", error);
  }
}

async function createTaskFromTopic(
  groupId: string,
  groupName: string,
  topic: SegmentedTopic,
  classification: TopicClassification,
  topicMessages: MessageRow[]
): Promise<void> {
  const sourceMessage = topicMessages[0];

  const { error } = await supabase.from("tasks").insert({
    source_message_id: sourceMessage?.id || null,
    title: classification.summary || topic.label,
    description: topicMessages.map((m) => m.message_text).join("\n"),
    assigned_to: classification.assigned_to || null,
    assigned_by: classification.assigned_by || null,
    group_name: groupName,
    status: classification.outcome === "completed" ? "done" : "new",
    priority: classification.priority || "normal",
    deadline: classification.deadline
      ? tryParseDeadline(classification.deadline)
      : null,
    completed_at:
      classification.outcome === "completed"
        ? new Date().toISOString()
        : null,
  });

  if (error) {
    console.error(`Failed to create task for topic "${topic.label}":`, error);
  }
}

async function createDirectionFromTopic(
  groupName: string,
  topic: SegmentedTopic,
  classification: TopicClassification,
  topicMessages: MessageRow[]
): Promise<void> {
  const sourceMessage = topicMessages[0];

  const { error } = await supabase.from("directions").insert({
    source_message_id: sourceMessage?.id || null,
    title: classification.summary || topic.label,
    content: topicMessages.map((m) => m.message_text).join("\n"),
    topic: topic.label,
    group_name: groupName,
    target_audience: null,
    is_still_valid: true,
  });

  if (error) {
    console.error(
      `Failed to create direction for topic "${topic.label}":`,
      error
    );
  }
}


// ─── Multi-Day Ongoing Topic Tracking ─────────────────────────────────────

async function checkOngoingTopics(dateStr: string): Promise<number> {
  const { data: ongoingTopics, error } = await supabase
    .from("daily_topics")
    .select("id, group_id, topic_label, key_participants, classification")
    .eq("is_ongoing", true)
    .lt("topic_date", dateStr)
    .order("topic_date", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Failed to fetch ongoing topics:", error);
    return 0;
  }

  if (!ongoingTopics || ongoingTopics.length === 0) return 0;

  let resolved = 0;

  const { data: todayTopics, error: todayError } = await supabase
    .from("daily_topics")
    .select("id, group_id, topic_label, classification, outcome")
    .eq("topic_date", dateStr);

  if (todayError || !todayTopics) return 0;

  for (const ongoing of ongoingTopics) {
    const continuation = todayTopics.find(
      (t: { id: string; group_id: string; topic_label: string; classification: string; outcome: string }) =>
        t.group_id === ongoing.group_id &&
        (t.outcome === "completed" || t.outcome === "answered") &&
        t.classification === ongoing.classification
    );

    if (continuation) {
      await supabase
        .from("daily_topics")
        .update({ is_ongoing: false })
        .eq("id", ongoing.id);

      await supabase
        .from("daily_topics")
        .update({ continued_from: ongoing.id })
        .eq("id", continuation.id);

      resolved++;
    }
  }

  return resolved;
}

// ─── Standalone Classification (for groups with <3 messages) ──────────────

async function classifyStandaloneMessages(
  aiProvider: AIProvider,
  group: ActiveGroup,
  messages: MessageRow[],
  dateStr: string
): Promise<{ topics: number; tasks: number; directions: number }> {
  let topics = 0;
  let tasks = 0;
  let directions = 0;

  for (const msg of messages) {
    const syntheticTopic: SegmentedTopic = {
      topic_id: 1,
      label: msg.message_text.substring(0, 40),
      message_indices: [1],
      key_participants: [
        msg.contacts?.display_name || msg.sender_name || msg.sender_jid,
      ],
      timespan_start: new Date(msg.timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      }),
      timespan_end: new Date(msg.timestamp).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Makassar",
      }),
    };

    try {
      const classification = await classifyTopic(
        aiProvider,
        group.name,
        syntheticTopic.label,
        dateStr,
        [msg],
        syntheticTopic.key_participants
      );

      const topicId = await saveDailyTopic(
        group.id,
        dateStr,
        syntheticTopic,
        classification,
        messages,
        [msg],
        aiProvider.modelName,
        { standalone: true, classification }
      );

      if (topicId) {
        topics++;
        if (classification.classification === "task") {
          await createTaskFromTopic(
            group.id,
            group.name,
            syntheticTopic,
            classification,
            [msg]
          );
          tasks++;
        } else if (classification.classification === "direction") {
          await createDirectionFromTopic(
            group.name,
            syntheticTopic,
            classification,
            [msg]
          );
          directions++;
        }
      }
    } catch (err) {
      console.error(
        `Error classifying standalone message in ${group.name}:`,
        err
      );
    }
  }

  return { topics, tasks, directions };
}

// ─── Deadline Parsing ─────────────────────────────────────────────────────

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

  const dateMatch = lower.match(
    /(\d{1,2})\s*(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|okt|oct|nov|des|dec)/i
  );
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

// ─── Duplicate Prevention ─────────────────────────────────────────────────

async function hasExistingAnalysis(
  groupId: string,
  dateStr: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("daily_topics")
    .select("id")
    .eq("group_id", groupId)
    .eq("topic_date", dateStr)
    .limit(1)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}


// ─── Main Entry Point ─────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const aiProvider = createAIProvider();
    console.log(`[analyze-daily] Using AI provider: ${aiProvider.modelName}`);

    let overrideDate: string | undefined;
    try {
      const body = await req.json();
      overrideDate = body?.date;
    } catch {
      // No body or invalid JSON — use default (yesterday)
    }

    const { startUtc, endUtc, dateStr } = getAnalysisDateRange(overrideDate);
    console.log(`[analyze-daily] Analyzing date: ${dateStr} (${startUtc} → ${endUtc})`);

    // FIXED: use wa_group_id-based lookup instead of group_id FK join
    const activeGroups = await getActiveGroupsWithMessages(startUtc, endUtc);
    console.log(`[analyze-daily] Found ${activeGroups.length} active groups`);

    if (activeGroups.length === 0) {
      return new Response(
        JSON.stringify({
          date: dateStr,
          groups_analyzed: 0,
          topics_found: 0,
          total_active_groups: 0,
          remaining: 0,
          batch_complete: true,
          message: "No active groups with messages for this date",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out already-analyzed groups, then take only BATCH_SIZE
    const pendingGroups: typeof activeGroups = [];
    for (const group of activeGroups) {
      if (!(await hasExistingAnalysis(group.id, dateStr))) {
        pendingGroups.push(group);
      }
    }

    const batchGroups = pendingGroups.slice(0, BATCH_SIZE);
    const remaining = pendingGroups.length - batchGroups.length;

    console.log(`[analyze-daily] ${activeGroups.length} active, ${pendingGroups.length} pending, processing batch of ${batchGroups.length}, ${remaining} remaining after this batch`);

    if (batchGroups.length === 0) {
      return new Response(
        JSON.stringify({
          date: dateStr,
          groups_analyzed: 0,
          topics_found: 0,
          total_active_groups: activeGroups.length,
          remaining: 0,
          batch_complete: true,
          message: "All groups already analyzed for this date",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalTopics = 0;
    let totalTasks = 0;
    let totalDirections = 0;
    let groupsAnalyzed = 0;
    const errors: string[] = [];

    for (const group of batchGroups) {
      console.log(`[analyze-daily] Processing group: ${group.name} (${group.message_count} msgs)`);

      // FIXED: fetch messages by wa_group_id instead of group_id UUID
      const messages = await getGroupMessages(group.wa_group_id, startUtc, endUtc);

      if (messages.length === 0) continue;

      groupsAnalyzed++;

      if (messages.length < MIN_MESSAGES_FOR_SEGMENTATION) {
        try {
          const result = await classifyStandaloneMessages(
            aiProvider,
            group,
            messages,
            dateStr
          );
          totalTopics += result.topics;
          totalTasks += result.tasks;
          totalDirections += result.directions;
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[analyze-daily] Error in standalone classification for ${group.name}:`, errMsg);
          errors.push(`${group.name} (standalone): ${errMsg}`);
        }
        continue;
      }

      const windows = splitIntoWindows(messages, MAX_MESSAGES_PER_WINDOW);

      for (const windowMessages of windows) {
        let segmentation: SegmentationResult;
        try {
          segmentation = await segmentTopics(
            aiProvider,
            group.name,
            dateStr,
            windowMessages
          );
          console.log(
            `[analyze-daily] ${group.name}: ${segmentation.topics.length} topics, ${segmentation.noise_indices.length} noise msgs`
          );
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[analyze-daily] Segmentation error for ${group.name}:`, errMsg);
          errors.push(`${group.name} (segmentation): ${errMsg}`);
          continue;
        }

        for (const topic of segmentation.topics) {
          const topicMessages = topic.message_indices
            .map((idx) => windowMessages[idx - 1])
            .filter(Boolean);

          if (topicMessages.length === 0) continue;

          try {
            const classification = await classifyTopic(
              aiProvider,
              group.name,
              topic.label,
              dateStr,
              topicMessages,
              topic.key_participants
            );

            const topicId = await saveDailyTopic(
              group.id,
              dateStr,
              topic,
              classification,
              windowMessages,
              topicMessages,
              aiProvider.modelName,
              { segmentation: topic, classification }
            );

            if (topicId) {
              totalTopics++;

              if (classification.classification === "task") {
                await createTaskFromTopic(
                  group.id,
                  group.name,
                  topic,
                  classification,
                  topicMessages
                );
                totalTasks++;
              } else if (classification.classification === "direction") {
                await createDirectionFromTopic(
                  group.name,
                  topic,
                  classification,
                  topicMessages
                );
                totalDirections++;
              }
            }
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            console.error(
              `[analyze-daily] Classification error for topic "${topic.label}" in ${group.name}:`,
              errMsg
            );
            errors.push(`${group.name}/"${topic.label}": ${errMsg}`);
          }
        }

        const noiseMessages = segmentation.noise_indices
          .map((idx) => windowMessages[idx - 1])
          .filter(Boolean);

        await saveNoiseTopic(group.id, dateStr, noiseMessages, aiProvider.modelName);
      }
    }

    const ongoingResolved = await checkOngoingTopics(dateStr);

    const result = {
      date: dateStr,
      groups_analyzed: groupsAnalyzed,
      topics_found: totalTopics,
      tasks_created: totalTasks,
      directions_created: totalDirections,
      ongoing_resolved: ongoingResolved,
      total_active_groups: activeGroups.length,
      remaining,
      batch_complete: remaining === 0,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("[analyze-daily] Analysis complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[analyze-daily] Fatal error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
