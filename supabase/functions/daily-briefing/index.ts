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
  db: { schema: "wa_intel" },
});

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function getJakartaToday(): { startUtc: string; endUtc: string; dateStr: string } {
  const nowUtc = new Date();
  const nowWib = new Date(nowUtc.getTime() + WIB_OFFSET_MS);
  const year = nowWib.getUTCFullYear();
  const month = nowWib.getUTCMonth();
  const day = nowWib.getUTCDate();

  const startWib = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const startUtc = new Date(startWib.getTime() - WIB_OFFSET_MS);
  const endUtc = new Date(startUtc.getTime() + 24 * 60 * 60 * 1000);

  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

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

async function getTodayMessages(startUtc: string, endUtc: string) {
  const { data, error } = await supabase
    .from("messages")
    .select("id, wa_group_id, groups:group_id(name)")
    .gte("timestamp", startUtc)
    .lt("timestamp", endUtc);

  if (error) throw new Error(`Messages query failed: ${error.message}`);
  return data || [];
}

async function getTodayClassified(startUtc: string, endUtc: string) {
  const { data, error } = await supabase
    .from("classified_items")
    .select("id, classification, message_id")
    .gte("classified_at", startUtc)
    .lt("classified_at", endUtc);

  if (error) throw new Error(`Classified query failed: ${error.message}`);
  return data || [];
}

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

function buildGroupSummaries(
  messages: { wa_group_id: string; groups: { name: string } | null }[],
  classified: { classification: string; message_id: string }[]
): GroupSummary[] {
  const classMap = new Map<string, string>();
  for (const c of classified) {
    classMap.set(c.message_id, c.classification);
  }

  const groups = new Map<string, GroupSummary>();

  for (const msg of messages) {
    const name = (msg as any).groups?.name || msg.wa_group_id;
    if (!groups.has(name)) {
      groups.set(name, { group_name: name, total: 0, tasks: 0, directions: 0 });
    }
    const g = groups.get(name)!;
    g.total++;
    const cls = classMap.get((msg as any).id);
    if (cls === "task") g.tasks++;
    if (cls === "direction") g.directions++;
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

function priorityTag(p: string | null): string {
  if (p === "urgent") return "[URGENT]";
  if (p === "high") return "[HIGH]";
  return "";
}

function daysOpen(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / (24 * 60 * 60 * 1000));
}

function buildBriefingText(
  dateStr: string,
  totalMessages: number,
  newTasks: TaskRow[],
  overdueTasks: TaskRow[],
  completedTasks: TaskRow[],
  newDirections: DirectionRow[],
  groupSummaries: GroupSummary[]
): string {
  const lines: string[] = [];
  const dateFormatted = formatDateIndo(dateStr);

  lines.push("=============================");
  lines.push(`DAILY BRIEFING - ${dateFormatted}`);
  lines.push("=============================");
  lines.push("");
  lines.push("RINGKASAN HARI INI:");
  lines.push(`- Total pesan: ${totalMessages}`);
  lines.push(`- Tugas baru: ${newTasks.length}`);
  lines.push(`- Arahan baru: ${newDirections.length}`);
  lines.push(`- Tugas selesai: ${completedTasks.length}`);
  lines.push(`- Tugas terlambat: ${overdueTasks.length}`);

  if (newTasks.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("TUGAS BARU:");
    newTasks.forEach((t, i) => {
      const tag = priorityTag(t.priority);
      const assignee = t.assigned_to ? ` - Ditugaskan ke: ${t.assigned_to}` : "";
      const dl = t.deadline ? ` (deadline: ${t.deadline})` : "";
      lines.push(`${i + 1}. ${tag}${tag ? " " : ""}${t.title}${assignee}${dl}`);
      if (t.group_name) lines.push(`   Grup: ${t.group_name}`);
    });
  }

  if (overdueTasks.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("TUGAS TERLAMBAT (>3 hari):");
    overdueTasks.forEach((t, i) => {
      const days = daysOpen(t.created_at);
      const assignee = t.assigned_to ? ` (${t.assigned_to})` : "";
      lines.push(`${i + 1}. ${t.title} - ${days} hari belum ada update${assignee}`);
      if (t.group_name) lines.push(`   Grup: ${t.group_name}`);
    });
  }

  if (completedTasks.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("TUGAS SELESAI:");
    completedTasks.forEach((t, i) => {
      const assignee = t.assigned_to ? ` (${t.assigned_to})` : "";
      lines.push(`${i + 1}. ${t.title}${assignee}`);
    });
  }

  if (newDirections.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("ARAHAN BARU:");
    newDirections.forEach((d, i) => {
      const topicTag = d.topic ? `[${d.topic}] ` : "";
      lines.push(`${i + 1}. ${topicTag}${d.title}`);
      if (d.group_name) lines.push(`   Dari: ${d.group_name}`);
    });
  }

  if (groupSummaries.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push("AKTIVITAS PER GRUP:");
    groupSummaries.forEach((g) => {
      lines.push(
        `- ${g.group_name}: ${g.total} pesan (${g.tasks} tugas, ${g.directions} arahan)`
      );
    });
  }

  lines.push("");
  lines.push("=============================");

  return lines.join("\n");
}

async function saveBriefing(
  dateStr: string,
  summaryText: string,
  newTasksCount: number,
  overdueCount: number,
  completedCount: number,
  directionsCount: number
) {
  const { error } = await supabase.from("daily_briefings").upsert(
    {
      briefing_date: dateStr,
      summary_text: summaryText,
      new_tasks_count: newTasksCount,
      overdue_tasks_count: overdueCount,
      completed_tasks_count: completedCount,
      new_directions_count: directionsCount,
      sent_via: "console",
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
    const { startUtc, endUtc, dateStr } = getJakartaToday();

    const [messages, classified, newTasks, overdueTasks, completedTasks, newDirections] =
      await Promise.all([
        getTodayMessages(startUtc, endUtc),
        getTodayClassified(startUtc, endUtc),
        getNewTasks(startUtc, endUtc),
        getOverdueTasks(),
        getCompletedTasks(startUtc, endUtc),
        getNewDirections(startUtc, endUtc),
      ]);

    const groupSummaries = buildGroupSummaries(
      messages as any,
      classified as any
    );

    const briefingText = buildBriefingText(
      dateStr,
      messages.length,
      newTasks,
      overdueTasks,
      completedTasks,
      newDirections,
      groupSummaries
    );

    console.log("\n" + briefingText);

    await saveBriefing(
      dateStr,
      briefingText,
      newTasks.length,
      overdueTasks.length,
      completedTasks.length,
      newDirections.length
    );

    return new Response(
      JSON.stringify({
        briefing_date: dateStr,
        summary: {
          total_messages: messages.length,
          new_tasks: newTasks.length,
          overdue_tasks: overdueTasks.length,
          completed_tasks: completedTasks.length,
          new_directions: newDirections.length,
          groups_active: groupSummaries.length,
        },
        briefing_text: briefingText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Briefing error:", errMsg);
    return new Response(
      JSON.stringify({ error: errMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
