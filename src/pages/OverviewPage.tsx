import { useEffect, useState } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Compass,
  MessageSquare,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { TaskStatusBadge, PriorityBadge } from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { supabase } from '../lib/supabase';
import type { Task, Direction, Group } from '../lib/types';

interface OverviewStats {
  totalTasks: number;
  overdueTasks: number;
  completedToday: number;
  activeDirections: number;
  totalMessages: number;
  activeGroups: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats>({
    totalTasks: 0,
    overdueTasks: 0,
    completedToday: 0,
    activeDirections: 0,
    totalMessages: 0,
    activeGroups: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentDirections, setRecentDirections] = useState<Direction[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOverview() {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      const [
        tasksRes,
        overdueRes,
        completedRes,
        directionsRes,
        messagesRes,
        groupsRes,
        recentTasksRes,
        recentDirsRes,
      ] = await Promise.all([
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress', 'stuck']),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress', 'stuck']).lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('completed_at', today),
        supabase.from('directions').select('id', { count: 'exact', head: true }).eq('is_still_valid', true),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        supabase.from('groups').select('*').eq('is_active', true).order('name'),
        supabase.from('tasks').select('*').in('status', ['new', 'in_progress', 'stuck']).order('created_at', { ascending: false }).limit(5),
        supabase.from('directions').select('*').eq('is_still_valid', true).order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({
        totalTasks: tasksRes.count || 0,
        overdueTasks: overdueRes.count || 0,
        completedToday: completedRes.count || 0,
        activeDirections: directionsRes.count || 0,
        totalMessages: messagesRes.count || 0,
        activeGroups: groupsRes.data?.length || 0,
      });
      setRecentTasks(recentTasksRes.data || []);
      setRecentDirections(recentDirsRes.data || []);
      setGroups(groupsRes.data || []);
      setLoading(false);
    }

    loadOverview();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hasData = stats.totalTasks > 0 || stats.totalMessages > 0 || groups.length > 0;

  return (
    <div className="space-y-6 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">HollyMart WhatsApp Intelligence overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Active Tasks" value={stats.totalTasks} icon={CheckSquare} color="blue" />
        <StatCard label="Overdue" value={stats.overdueTasks} icon={AlertTriangle} color="red" />
        <StatCard label="Completed Today" value={stats.completedToday} icon={CheckCircle2} color="emerald" />
        <StatCard label="Active Directions" value={stats.activeDirections} icon={Compass} color="teal" />
        <StatCard label="Total Messages" value={stats.totalMessages.toLocaleString()} icon={MessageSquare} color="blue" />
        <StatCard label="Active Groups" value={stats.activeGroups} icon={Clock} color="amber" />
      </div>

      {!hasData ? (
        <EmptyState
          icon={MessageSquare}
          title="No data yet"
          description="Connect the Baileys listener to start capturing WhatsApp messages. Data will appear here once messages are ingested and classified."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Recent Tasks</h2>
              <Link to="/tasks" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No active tasks</div>
            ) : (
              <div className="divide-y">
                {recentTasks.map((task) => (
                  <div key={task.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {task.group_name && (
                            <span className="text-xs text-gray-500">{task.group_name}</span>
                          )}
                          {task.assigned_to && (
                            <span className="text-xs text-gray-400">@{task.assigned_to}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <PriorityBadge priority={task.priority} />
                        <TaskStatusBadge status={task.status} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Recent Directions</h2>
              <Link to="/directions" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {recentDirections.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No directions yet</div>
            ) : (
              <div className="divide-y">
                {recentDirections.map((dir) => (
                  <div key={dir.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-medium text-gray-900 truncate">{dir.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {dir.topic && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                          {dir.topic}
                        </span>
                      )}
                      {dir.group_name && (
                        <span className="text-xs text-gray-500">{dir.group_name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {groups.length > 0 && (
            <div className="bg-white rounded-xl border lg:col-span-2">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-900">Monitored Groups</h2>
                <Link to="/groups" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y sm:divide-y-0">
                {groups.slice(0, 6).map((group) => (
                  <div key={group.id} className="px-5 py-3 sm:border-r last:border-r-0 hover:bg-gray-50 transition-colors">
                    <p className="text-sm font-medium text-gray-900 truncate">{group.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {group.participant_count} members
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
