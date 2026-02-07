import type { TaskStatus, Priority, Classification } from '../lib/types';

const statusStyles: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  new: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'New' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'In Progress' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Done' },
  stuck: { bg: 'bg-red-50', text: 'text-red-700', label: 'Stuck' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
};

const priorityStyles: Record<Priority, { bg: string; text: string; dot: string }> = {
  urgent: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  normal: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  low: { bg: 'bg-slate-50', text: 'text-slate-500', dot: 'bg-slate-400' },
};

const classificationStyles: Record<Classification, { bg: string; text: string }> = {
  task: { bg: 'bg-blue-50', text: 'text-blue-700' },
  direction: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  report: { bg: 'bg-teal-50', text: 'text-teal-700' },
  question: { bg: 'bg-amber-50', text: 'text-amber-700' },
  coordination: { bg: 'bg-gray-100', text: 'text-gray-600' },
  noise: { bg: 'bg-gray-50', text: 'text-gray-400' },
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const style = statusStyles[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const style = priorityStyles[priority];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </span>
  );
}

export function ClassificationBadge({ classification }: { classification: Classification }) {
  const style = classificationStyles[classification];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      {classification.charAt(0).toUpperCase() + classification.slice(1)}
    </span>
  );
}
