import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: "hmso" },
});

const COMPLETION_KEYWORDS = [
  "sudah",
  "selesai",
  "done",
  "sudah dikerjakan",
  "sudah beres",
  "sudah selesai",
  "sudah dilakukan",
  "sudah dijalankan",
  "already done",
  "completed",
];

const TASK_COMPLETION_WINDOW_DAYS = 7;

interface OpenTask {
  id: string;
  title: string;
  assigned_to: string | null;
  group_name: string | null;
  status: string;
  created_at: string;
  source_message_id: string | null;
}

interface CandidateMessage {
  id: string;
  message_text: string;
  sender_name: string | null;
  timestamp: string;
  contact_display_name: string | null;
  contact_short_name: string | null;
}

function containsCompletionKeyword(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return COMPLETION_KEYWORDS.some((keyword) => lower.includes(keyword));
}

function nameMatches(
  assignedTo: string,
  displayName: string | null,
  shortName: string | null,
  senderName: string | null
): boolean {
  const target = assignedTo.toLowerCase().trim();
  if (!target) return false;

  const candidates = [displayName, shortName, senderName]
    .filter(Boolean)
    .map((n) => n!.toLowerCase().trim());

  return candidates.some(
    (name) => name.includes(target) || target.includes(name)
  );
}

async function getGroupWaId(groupName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("groups")
    .select("wa_group_id")
    .eq("name", groupName)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(`Failed to find group "${groupName}":`, error);
    return null;
  }

  return data?.wa_group_id || null;
}

async function fetchOpenTasks(): Promise<OpenTask[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, group_name, status, created_at, source_message_id")
    .not("status", "in", "(done,cancelled)")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch open tasks: ${error.message}`);
  }

  return (data as OpenTask[]) || [];
}

async function findCompletionMessages(
  waGroupId: string,
  assignedTo: string,
  taskCreatedAt: string
): Promise<CandidateMessage[]> {
  const windowEnd = new Date(taskCreatedAt);
  windowEnd.setDate(windowEnd.getDate() + TASK_COMPLETION_WINDOW_DAYS);

  const { data, error } = await supabase
    .from("messages")
    .select(
      `
      id, message_text, sender_name, timestamp,
      contacts:contact_id(display_name, short_name)
    `
    )
    .eq("wa_group_id", waGroupId)
    .not("message_text", "is", null)
    .gt("timestamp", taskCreatedAt)
    .lt("timestamp", windowEnd.toISOString())
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error) {
    console.error(
      `Failed to search messages in group ${waGroupId}:`,
      error
    );
    return [];
  }

  if (!data) return [];

  // deno-lint-ignore no-explicit-any
  return (data as any[]).map((row) => ({
    id: row.id,
    message_text: row.message_text,
    sender_name: row.sender_name,
    timestamp: row.timestamp,
    contact_display_name: row.contacts?.display_name || null,
    contact_short_name: row.contacts?.short_name || null,
  }));
}

async function markTaskDone(
  taskId: string,
  completionMessageId: string,
  completionTimestamp: string
): Promise<boolean> {
  const { error } = await supabase
    .from("tasks")
    .update({
      status: "done",
      completed_at: completionTimestamp,
      completion_message_id: completionMessageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) {
    console.error(`Failed to mark task ${taskId} as done:`, error);
    return false;
  }

  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const openTasks = await fetchOpenTasks();
    console.log(`Found ${openTasks.length} open tasks to check`);

    let checked = 0;
    let completed = 0;
    const errors: string[] = [];
    const completedTasks: { taskId: string; title: string; matchedMessage: string }[] = [];

    for (const task of openTasks) {
      // Skip tasks without assigned_to — can't match completion messages
      if (!task.assigned_to) {
        console.log(`Skipping task "${task.title}" — no assigned_to`);
        continue;
      }

      // Skip tasks without group_name — can't scope message search
      if (!task.group_name) {
        console.log(`Skipping task "${task.title}" — no group_name`);
        continue;
      }

      checked++;

      try {
        const waGroupId = await getGroupWaId(task.group_name);
        if (!waGroupId) {
          errors.push(
            `Task "${task.title}": group "${task.group_name}" not found`
          );
          continue;
        }

        const messages = await findCompletionMessages(
          waGroupId,
          task.assigned_to,
          task.created_at
        );

        // Find a message from the assigned person that contains a completion keyword
        const match = messages.find(
          (msg) =>
            nameMatches(
              task.assigned_to!,
              msg.contact_display_name,
              msg.contact_short_name,
              msg.sender_name
            ) && containsCompletionKeyword(msg.message_text)
        );

        if (match) {
          const success = await markTaskDone(
            task.id,
            match.id,
            match.timestamp
          );
          if (success) {
            completed++;
            completedTasks.push({
              taskId: task.id,
              title: task.title,
              matchedMessage: match.message_text.substring(0, 100),
            });
            console.log(
              `✓ Task "${task.title}" marked done via message: "${match.message_text.substring(0, 80)}"`
            );
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`Task "${task.title}": ${errMsg}`);
      }
    }

    const result = {
      checked,
      completed,
      completed_tasks: completedTasks.length > 0 ? completedTasks : undefined,
      errors: errors.length > 0 ? errors : undefined,
      total_open_tasks: openTasks.length,
    };

    console.log("Task completion detection complete:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("Task completion detection error:", errMsg);
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
