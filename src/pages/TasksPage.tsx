import { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Plus, Filter, X } from 'lucide-react';
import { TaskStatusBadge, PriorityBadge } from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { supabase } from '../lib/supabase';
import type { Task, TaskStatus } from '../lib/types';

const columns: { status: TaskStatus; label: string; color: string }[] = [
  { status: 'new', label: 'New', color: 'border-blue-400' },
  { status: 'in_progress', label: 'In Progress', color: 'border-amber-400' },
  { status: 'stuck', label: 'Stuck / Overdue', color: 'border-red-400' },
  { status: 'done', label: 'Done', color: 'border-emerald-400' },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (filterGroup) {
      query = query.eq('group_name', filterGroup);
    }
    if (filterAssignee) {
      query = query.eq('assigned_to', filterAssignee);
    }

    const { data } = await query;
    setTasks(data || []);
    setLoading(false);
  }, [filterGroup, filterAssignee]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    const updates: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (newStatus === 'done') {
      updates.completed_at = new Date().toISOString();
    }
    await supabase.from('tasks').update(updates).eq('id', taskId);
    fetchTasks();
  };

  const getTasksByStatus = (status: TaskStatus) =>
    tasks.filter((t) => t.status === status);

  const uniqueGroups = [...new Set(tasks.map((t) => t.group_name).filter(Boolean))];
  const uniqueAssignees = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))];

  const activeFilters = [filterGroup, filterAssignee].filter(Boolean).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kanban board for tracking WA tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showFilters ? 'bg-gray-100 text-gray-900' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-emerald-600 text-white text-[10px] rounded-full flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-end slide-in">
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Group</label>
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">All groups</option>
              {uniqueGroups.map((g) => (
                <option key={g} value={g!}>{g}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Anyone</option>
              {uniqueAssignees.map((a) => (
                <option key={a} value={a!}>{a}</option>
              ))}
            </select>
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterGroup(''); setFilterAssignee(''); }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 pb-2"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      )}

      {tasks.length === 0 && !filterGroup && !filterAssignee ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks yet"
          description="Tasks will appear here once the AI classifier processes WhatsApp messages and extracts actionable items."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columns.map((col) => {
            const colTasks = getTasksByStatus(col.status);
            return (
              <div key={col.status} className="bg-gray-50/80 rounded-xl p-3">
                <div className={`flex items-center justify-between mb-3 pb-2 border-b-2 ${col.color}`}>
                  <h3 className="text-sm font-semibold text-gray-700">{col.label}</h3>
                  <span className="text-xs font-medium text-gray-400 bg-white px-1.5 py-0.5 rounded">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2 kanban-column scrollbar-thin max-h-[calc(100vh-280px)] overflow-y-auto">
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onStatusChange={updateTaskStatus}
                      columns={columns}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-8">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); fetchTasks(); }}
        />
      )}
    </div>
  );
}

function TaskCard({
  task,
  onStatusChange,
  columns,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  columns: { status: TaskStatus; label: string }[];
}) {
  const [showActions, setShowActions] = useState(false);

  const daysAgo = Math.floor(
    (Date.now() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <div
      className="bg-white rounded-lg border p-3 hover:shadow-sm transition-all cursor-pointer group"
      onClick={() => setShowActions(!showActions)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug">{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>

      {task.description && (
        <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center flex-wrap gap-2 mt-2.5">
        {task.group_name && (
          <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
            {task.group_name}
          </span>
        )}
        {task.assigned_to && (
          <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
            @{task.assigned_to}
          </span>
        )}
        <span className="text-[10px] text-gray-400 ml-auto">
          {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
        </span>
      </div>

      {showActions && (
        <div className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-1.5">
          {columns
            .filter((c) => c.status !== task.status)
            .map((c) => (
              <button
                key={c.status}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusChange(task.id, c.status);
                }}
                className="text-[10px] font-medium px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Move to {c.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function AddTaskModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [groupName, setGroupName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    await supabase.from('tasks').insert({
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo.trim() || null,
      priority,
      group_name: groupName.trim() || null,
      status: 'new',
    });
    setSaving(false);
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 fade-in">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Add Task</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Task title..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Details..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Assigned To</label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Group</label>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Group name"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Adding...' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
