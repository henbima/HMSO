export interface Group {
  id: string;
  wa_group_id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  participant_count: number;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  wa_jid: string;
  phone_number: string | null;
  display_name: string;
  short_name: string | null;
  role: string | null;
  location: string | null;
  department: string | null;
  is_leadership: boolean;
  is_active: boolean;
  hmcs_employee_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  wa_message_id: string | null;
  group_id: string | null;
  wa_group_id: string;
  sender_jid: string;
  sender_name: string | null;
  contact_id: string | null;
  message_text: string | null;
  message_type: string;
  media_url: string | null;
  is_from_hendra: boolean;
  quoted_message_id: string | null;
  timestamp: string;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export interface ClassifiedItem {
  id: string;
  message_id: string;
  classification: 'task' | 'direction' | 'report' | 'question' | 'coordination' | 'noise';
  confidence: number | null;
  summary: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  deadline: string | null;
  deadline_parsed: string | null;
  topic: string | null;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  ai_model: string | null;
  classified_at: string;
  created_at: string;
}

export interface Task {
  id: string;
  classified_item_id: string | null;
  source_message_id: string | null;
  title: string;
  description: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  group_name: string | null;
  status: 'new' | 'in_progress' | 'done' | 'stuck' | 'cancelled';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  deadline: string | null;
  completed_at: string | null;
  completion_message_id: string | null;
  days_without_response: number;
  created_at: string;
  updated_at: string;
}

export interface Direction {
  id: string;
  source_message_id: string | null;
  title: string;
  content: string;
  topic: string | null;
  group_name: string | null;
  target_audience: string | null;
  is_still_valid: boolean;
  superseded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyBriefing {
  id: string;
  briefing_date: string;
  summary_text: string;
  new_tasks_count: number;
  overdue_tasks_count: number;
  completed_tasks_count: number;
  new_directions_count: number;
  sent_at: string | null;
  sent_via: string;
  created_at: string;
}

export interface TodaySummary {
  group_name: string;
  wa_group_id: string;
  total_messages: number;
  task_count: number;
  direction_count: number;
  report_count: number;
}

export type TaskStatus = Task['status'];
export type Classification = ClassifiedItem['classification'];
export type Priority = Task['priority'];
