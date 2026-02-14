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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "hmso" },
});

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaDate(daysOffset = 0): { startUtc: string; endUtc: string; dateStr: string } {
  const nowUtc = new Date();
  const nowWib = new Date(nowUtc.getTime() + WIB_OFFSET_MS);
  const year = nowWib.getUTCFullYear();
  const month = nowWib.getUTCMonth();
  const day = nowWib.getUTCDate() + daysOffset;

  const startWib = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const startUtc = new Date(startWib.getTime() - WIB_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  const actualDate = new Date(Date.UTC(year, month, day));
  const y = actualDate.getUTCFullYear();
  const m = actualDate.getUTCMonth();
  const d = actualDate.getUTCDate();
  const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return {
    startUtc: startUtc.toISOString(),
    endUtc: endUtc.toISOString(),
    dateStr,
  };
}

function formatDateIndo(dateStr: string): string {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}

interface TaskRow {
  id: string;
  title: string;
  assigned_to: string | null;
  assigned_by: string | null;
  group_name: string | null;
  priority: string | null;
  deadline: string | null;
  status: string | null;
  created_at: string;
  days_without_response: number | null;
}

interface DirectionRow {
  id: string;
  title: string;
  content: string;
  topic: string | null;
  group_name: string | null;
  created_at: string;
}

interface GroupSummary {
  group_name: string;
  total: number;
  tasks: number;
  directions: number;
}

// ─── Topic-Based Data Fetching (new, from daily_topics) ───────────────────

interface DailyTopicRow {
  id: string;
  group_id: string;
  topic_label: string;
  message_count: number;
  classification: string;
  summary: string;
  outcome: string;
  priority: string;
  action_needed: boolean;
  assigned_to: string | null;
  assigned_by: string | null;
  is_ongoing: boolean;
  continued_from: string | null;
  groups: { name: string } | null;
}

async function getDailyTopics(dateStr: string): Promise<DailyTopicRow[]> {
  const { data, error } = await supabase
    .from("daily_topics")
    .select(
      `id, group_id, topic_label, message_count, classification, summary,
       outcome, priority, action_needed, assigned_to, assigned_by,
       is_ongoing, continued_from,
       groups:group_id(name)`
    )
    .eq("topic_date", dateStr)
    .order("priority", { ascending: true });

  if (error) throw new Error(`Daily topics query failed: ${error.message}`);
  return (data as unknown as DailyTopicRow[]) || [];
}

async function getOngoingTopics(): Promise<DailyTopicRow[]> {
  const { data, error } = await supabase
    .from("daily_topics")
    .select(
      `id, group_id, topic_label, message_count, classification, summary,
       outcome, priority, action_needed, assigned_to, assigned_by,
       is_ongoing, continued_from,
       groups:group_id(name)`
    )
    .eq("is_ongoing", true)
    .order("topic_date", { ascending: false })
    .limit(20);

  if (error) throw new Error(`Ongoing topics query failed: ${error.message}`);
  return (data as unknown as DailyTopicRow[]) || [];
}

async function getTodayMessageCount(startUtc: string, endUtc: string): Promise<number> {
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .gte("timestamp", startUtc)
    .lt("timestamp", endUtc);

  if (error) return 0;
  return count || 0;
}

// ─── Legacy Data Fetching (fallback) ──────────────────────────────────────

async function getNewTasks(startUtc: string, endUtc: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, assigned_by, group_name, priority, deadline, status, created_at, days_without_response")
    .gte("created_at", startUtc)
    .lt("created_at", endUtc)
    .order("priority", { ascending: true });

  if (error) throw new Error(`New tasks query failed: ${error.message}`);
  return (data as TaskRow[]) || [];
}

async function getOverdueTasks(): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, assigned_by, group_name, priority, deadline, status, created_at, days_without_response")
    .not("status", "in", '("done","cancelled")')
    .lt("created_at", new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Overdue tasks query failed: ${error.message}`);
  return (data as TaskRow[]) || [];
}

async function getCompletedTasks(startUtc: string, endUtc: string): Promise<TaskRow[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, assigned_by, group_name, priority, deadline, status, created_at, days_without_response")
    .eq("status", "done")
    .gte("updated_at", startUtc)
    .lt("updated_at", endUtc);

  if (error) throw new Error(`Completed tasks query failed: ${error.message}`);
  return (data as TaskRow[]) || [];
}

async function getNewDirections(startUtc: string, endUtc: string): Promise<DirectionRow[]> {
  const { data, error } = await supabase
    .from("directions")
    .select("id, title, content, topic, group_name, created_at")
    .gte("created_at", startUtc)
    .lt("created_at", endUtc)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Directions query failed: ${error.message}`);
  return (data as DirectionRow[]) || [];
}

function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
}

// ─── Topic-Based Briefing Builder (new) ───────────────────────────────────

function outcomeEmoji(outcome: string): string {
  switch (outcome) {
    case "completed": return "\u2705";
    case "pending": return "\u23F3";
    case "answered": return "\u2705";
    case "ongoing": return "\uD83D\uDD04";
    case "no_action_needed": return "\u2139\uFE0F";
    default: return "";
  }
}

function outcomeLabel(outcome: string): string {
  switch (outcome) {
    case "completed": return "SELESAI";
    case "pending": return "MENUNGGU";
    case "answered": return "TERJAWAB";
    case "ongoing": return "BERLANJUT";
    case "no_action_needed": return "";
    default: return "";
  }
}

function buildTopicBasedBriefing(
  dateStr: string,
  totalMessages: number,
  topics: DailyTopicRow[],
  ongoingTopics: DailyTopicRow[],
  overdueTasks: TaskRow[]
): string {
  const lines: string[] = [];
  const dateFormatted = formatDateIndo(dateStr);

  const nonNoiseTopics = topics.filter((t) => t.classification !== "noise");
  const uniqueGroups = new Set(topics.map((t) => t.groups?.name || "Unknown"));

  lines.push(`\uD83D\uDCCA HollyMart Daily Brief \u2014 ${dateFormatted}`);
  lines.push("");
  lines.push(
    `\uD83D\uDCC8 Ringkasan: ${uniqueGroups.size} grup aktif, ${totalMessages} pesan, ${nonNoiseTopics.length} topik teridentifikasi`
  );
  lines.push("");

  // Task topics
  const taskTopics = topics.filter((t) => t.classification === "task");
  if (taskTopics.length > 0) {
    lines.push(`\uD83C\uDD95 Task (${taskTopics.length}):`);
    for (const t of taskTopics) {
      const group = t.groups?.name || "N/A";
      const assignee = t.assigned_to ? `@${t.assigned_to}` : "Unassigned";
      const emoji = outcomeEmoji(t.outcome);
      const label = outcomeLabel(t.outcome);
      const status = label ? ` ${emoji} ${label}` : "";
      lines.push(`\u2022 [${group}] ${t.summary || t.topic_label} \u2192 ${assignee}`);
      if (status) lines.push(`  ${status}`);
    }
    lines.push("");
  }

  // Overdue tasks from tasks table
  if (overdueTasks.length > 0) {
    lines.push(`\u26A0\uFE0F Overdue / No Response (${overdueTasks.length}):`);
    for (const t of overdueTasks) {
      const days = daysOpen(t.created_at);
      const assignee = t.assigned_to ? `@${t.assigned_to}` : "Unassigned";
      lines.push(`\u2022 [${t.group_name || "N/A"}] ${t.title} \u2192 ${assignee} (${days} hari)`);
    }
    lines.push("");
  }

  // Direction topics
  const directionTopics = topics.filter((t) => t.classification === "direction");
  if (directionTopics.length > 0) {
    lines.push(`\uD83D\uDCDD Arahan (${directionTopics.length}):`);
    for (const t of directionTopics) {
      const group = t.groups?.name || "N/A";
      lines.push(`\u2022 [${group}] ${t.summary || t.topic_label}`);
    }
    lines.push("");
  }

  // Items needing attention (action_needed = true, not task/direction)
  const attentionTopics = topics.filter(
    (t) =>
      t.action_needed &&
      t.classification !== "task" &&
      t.classification !== "direction" &&
      t.classification !== "noise"
  );
  if (attentionTopics.length > 0) {
    lines.push(`\u26A0\uFE0F Butuh Perhatian (${attentionTopics.length}):`);
    for (const t of attentionTopics) {
      const group = t.groups?.name || "N/A";
      lines.push(`\u2022 [${group}] ${t.summary || t.topic_label}`);
    }
    lines.push("");
  }

  // Report topics
  const reportTopics = topics.filter((t) => t.classification === "report");
  if (reportTopics.length > 0) {
    lines.push(`\uD83D\uDCCB Laporan (${reportTopics.length}):`);
    for (const t of reportTopics) {
      const group = t.groups?.name || "N/A";
      lines.push(`\u2022 [${group}] ${t.summary || t.topic_label}`);
    }
    lines.push("");
  }

  // Ongoing conversations from previous days
  if (ongoingTopics.length > 0) {
    lines.push(`\uD83D\uDD04 Percakapan Aktif (dari hari sebelumnya):`);
    for (const t of ongoingTopics) {
      const group = t.groups?.name || "N/A";
      lines.push(`\u2022 [${group}] ${t.summary || t.topic_label}`);
    }
    lines.push("");
  }

  // Group activity summary
  const groupActivity = new Map<string, { total: number; important: number }>();
  for (const t of topics) {
    const name = t.groups?.name || "Unknown";
    const existing = groupActivity.get(name) || { total: 0, important: 0 };
    existing.total += t.message_count;
    if (t.classification !== "noise") existing.important++;
    groupActivity.set(name, existing);
  }

  if (groupActivity.size > 0) {
    lines.push("\uD83D\uDCAC Aktivitas Grup:");
    const sorted = Array.from(groupActivity.entries()).sort(
      (a, b) => b[1].total - a[1].total
    );
    for (const [name, stats] of sorted) {
      lines.push(`\u2022 ${name}: ${stats.total} pesan, ${stats.important} topik penting`);
    }
  }

  return lines.join("\n");
}

// ─── Save Briefing ────────────────────────────────────────────────────────

async function saveBriefing(
  dateStr: string,
  summaryText: string,
  newTasksCount: number,
  overdueCount: number,
  completedCount: number,
  directionsCount: number,
  topicsAnalyzed: number,
  groupsAnalyzed: number,
  ongoingCount: number
) {
  const { error } = await supabase.from("daily_briefings").upsert(
    {
      briefing_date: dateStr,
      summary_text: summaryText,
      new_tasks_count: newTasksCount,
      overdue_tasks_count: overdueCount,
      completed_tasks_count: completedCount,
      new_directions_count: directionsCount,
      topics_analyzed: topicsAnalyzed,
      groups_analyzed: groupsAnalyzed,
      ongoing_topics_count: ongoingCount,
      sent_via: "pending",
    },
    { onConflict: "briefing_date" }
  );

  if (error) {
    console.error("Failed to save briefing:", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Support date override: POST { "date": "2026-02-09" } generates briefing FOR that date using its topic data
    let overrideDate: string | undefined;
    try {
      const body = await req.json();
      overrideDate = body?.date;
    } catch {
      // No body or invalid JSON — use default
    }

    let today: { startUtc: string; endUtc: string; dateStr: string };
    let yesterday: { startUtc: string; endUtc: string; dateStr: string };

    if (overrideDate) {
      // When date is overridden, "yesterday" = the override date (topic source), "today" = override date (briefing date)
      const start = new Date(`${overrideDate}T00:00:00+07:00`);
      const end = new Date(`${overrideDate}T23:59:59.999+07:00`);
      yesterday = {
        startUtc: start.toISOString(),
        endUtc: end.toISOString(),
        dateStr: overrideDate,
      };
      today = { ...yesterday };
    } else {
      today = getJakartaDate(0);
      yesterday = getJakartaDate(-1);
    }

    console.log(`[daily-briefing] Briefing date: ${today.dateStr}, topic analysis date: ${yesterday.dateStr}`);

    // Try topic-based approach first (Spec 202) - topics are from yesterday's analysis
    const dailyTopics = await getDailyTopics(yesterday.dateStr);

    if (dailyTopics.length > 0) {
      // Topic-based briefing (new approach)
      console.log(`[daily-briefing] Using topic-based approach: ${dailyTopics.length} topics`);

      const [ongoingTopics, overdueTasks, totalMessages] = await Promise.all([
        getOngoingTopics(),
        getOverdueTasks(),
        getTodayMessageCount(yesterday.startUtc, yesterday.endUtc),
      ]);

      const taskTopics = dailyTopics.filter((t) => t.classification === "task");
      const completedTaskTopics = taskTopics.filter((t) => t.outcome === "completed");
      const directionTopics = dailyTopics.filter((t) => t.classification === "direction");
      const uniqueGroups = new Set(dailyTopics.map((t) => t.group_id));

      const briefingText = buildTopicBasedBriefing(
        yesterday.dateStr,
        totalMessages,
        dailyTopics,
        ongoingTopics,
        overdueTasks
      );

      console.log("\n" + briefingText);

      await saveBriefing(
        today.dateStr,
        briefingText,
        taskTopics.length,
        overdueTasks.length,
        completedTaskTopics.length,
        directionTopics.length,
        dailyTopics.filter((t) => t.classification !== "noise").length,
        uniqueGroups.size,
        ongoingTopics.length
      );

      return new Response(
        JSON.stringify({
          briefing_date: today.dateStr,
          analysis_date: yesterday.dateStr,
          mode: "topic-based",
          summary: {
            total_messages: totalMessages,
            topics_analyzed: dailyTopics.length,
            new_tasks: taskTopics.length,
            overdue_tasks: overdueTasks.length,
            completed_tasks: completedTaskTopics.length,
            new_directions: directionTopics.length,
            ongoing_topics: ongoingTopics.length,
            groups_active: uniqueGroups.size,
          },
          briefing_text: briefingText,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fallback: legacy approach (no daily_topics for this date)
    console.log("[daily-briefing] No daily topics found, using legacy approach");

    const [newTasks, overdueTasks, completedTasks, newDirections, totalMessages] =
      await Promise.all([
        getNewTasks(yesterday.startUtc, yesterday.endUtc),
        getOverdueTasks(),
        getCompletedTasks(yesterday.startUtc, yesterday.endUtc),
        getNewDirections(yesterday.startUtc, yesterday.endUtc),
        getTodayMessageCount(yesterday.startUtc, yesterday.endUtc),
      ]);

    // Simple legacy briefing
    const lines: string[] = [];
    const dateFormatted = formatDateIndo(yesterday.dateStr);
    lines.push(`\uD83D\uDCCA HollyMart Daily Brief \u2014 ${dateFormatted}`);
    lines.push("");
    lines.push(`\uD83D\uDCC8 Ringkasan: ${totalMessages} pesan hari ini`);
    lines.push("");

    if (newTasks.length > 0) {
      lines.push(`\uD83C\uDD95 Task Baru (${newTasks.length}):`);
      for (const t of newTasks) {
        const assignee = t.assigned_to ? `@${t.assigned_to}` : "Unassigned";
        lines.push(`\u2022 [${t.group_name || "N/A"}] ${t.title} \u2192 ${assignee}`);
      }
      lines.push("");
    }

    if (overdueTasks.length > 0) {
      lines.push(`\u26A0\uFE0F Overdue (${overdueTasks.length}):`);
      for (const t of overdueTasks) {
        const days = daysOpen(t.created_at);
        const assignee = t.assigned_to ? `@${t.assigned_to}` : "Unassigned";
        lines.push(`\u2022 [${t.group_name || "N/A"}] ${t.title} \u2192 ${assignee} (${days} hari)`);
      }
      lines.push("");
    }

    if (completedTasks.length > 0) {
      lines.push(`\u2705 Completed (${completedTasks.length}):`);
      for (const t of completedTasks) {
        lines.push(`\u2022 [${t.group_name || "N/A"}] ${t.title} \u2713`);
      }
      lines.push("");
    }

    if (newDirections.length > 0) {
      lines.push(`\uD83D\uDCDD Arahan (${newDirections.length}):`);
      for (const d of newDirections) {
        lines.push(`\u2022 [${d.group_name || "N/A"}] ${d.title}`);
      }
    }

    const briefingText = lines.join("\n");
    console.log("\n" + briefingText);

    await saveBriefing(
      today.dateStr,
      briefingText,
      newTasks.length,
      overdueTasks.length,
      completedTasks.length,
      newDirections.length,
      0,
      0,
      0
    );

    return new Response(
      JSON.stringify({
        briefing_date: today.dateStr,
        analysis_date: yesterday.dateStr,
        mode: "legacy",
        summary: {
          total_messages: totalMessages,
          new_tasks: newTasks.length,
          overdue_tasks: overdueTasks.length,
          completed_tasks: completedTasks.length,
          new_directions: newDirections.length,
        },
        briefing_text: briefingText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[daily-briefing] Error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
