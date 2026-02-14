import { useEffect, useState } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  CheckCircle2,
  Compass,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  Star,
  Users,
  Activity,
  ChevronRight,
  Database,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { TaskStatusBadge, PriorityBadge } from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { hmso } from '../lib/supabase';
import type { Task, Direction, Group } from '../lib/types';

interface SyncRequest {
  id: string;
  status: string;
  requested_at: string;
  completed_at: string | null;
  groups_synced: number | null;
}

interface OverviewStats {
  totalTasks: number;
  overdueTasks: number;
  completedToday: number;
  activeDirections: number;
  totalMessages: number;
  activeGroups: number;
  monitoredGroups: number;
}

interface GroupWithStats extends Group {
  today_message_count: number;
  total_message_count: number;
  flagged_count: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<OverviewStats>({
    totalTasks: 0,
    overdueTasks: 0,
    completedToday: 0,
    activeDirections: 0,
    totalMessages: 0,
    activeGroups: 0,
    monitoredGroups: 0,
  });
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentDirections, setRecentDirections] = useState<Direction[]>([]);
  const [starredGroups, setStarredGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncRequest, setSyncRequest] = useState<SyncRequest | null>(null);
  const [syncing, setSyncing] = useState(false);

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
        groupsCountRes,
        starredGroupsRes,
        recentTasksRes,
        recentDirsRes,
      ] = await Promise.all([
        hmso.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress', 'stuck']),
        hmso.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress', 'stuck']).lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
        hmso.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('completed_at', today),
        hmso.from('directions').select('id', { count: 'exact', head: true }).eq('is_still_valid', true),
        hmso.from('messages').select('id', { count: 'exact', head: true }),
        hmso.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
        hmso.rpc('get_groups_with_today_stats'),
        hmso.from('tasks').select('*').in('status', ['new', 'in_progress', 'stuck']).order('created_at', { ascending: false }).limit(5),
        hmso.from('directions').select('*').eq('is_still_valid', true).order('created_at', { ascending: false }).limit(5),
      ]);

      const allGroups = (starredGroupsRes.data || []) as GroupWithStats[];
      const starred = allGroups.filter(g => g.is_starred);

      setStats({
        totalTasks: tasksRes.count || 0,
        overdueTasks: overdueRes.count || 0,
        completedToday: completedRes.count || 0,
        activeDirections: directionsRes.count || 0,
        totalMessages: messagesRes.count || 0,
        activeGroups: groupsCountRes.count || 0,
        monitoredGroups: starred.length,
      });
      setRecentTasks(recentTasksRes.data || []);
      setRecentDirections(recentDirsRes.data || []);
      setStarredGroups(starred);
      setLoading(false);
    }

    loadOverview();

    hmso
      .from('sync_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSyncRequest(data);
          if (data.status === 'pending' || data.status === 'processing') {
            setSyncing(true);
          }
        }
      });
  }, []);

  const refetchData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const [
      tasksRes,
      overdueRes,
      completedRes,
      directionsRes,
      messagesRes,
      groupsCountRes,
      starredGroupsRes,
      recentTasksRes,
      recentDirsRes,
    ] = await Promise.all([
      hmso.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress', 'stuck']),
      hmso.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['new', 'in_progress', 'stuck']).lt('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()),
      hmso.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'done').gte('completed_at', today),
      hmso.from('directions').select('id', { count: 'exact', head: true }).eq('is_still_valid', true),
      hmso.from('messages').select('id', { count: 'exact', head: true }),
      hmso.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true),
      hmso.rpc('get_groups_with_today_stats'),
      hmso.from('tasks').select('*').in('status', ['new', 'in_progress', 'stuck']).order('created_at', { ascending: false }).limit(5),
      hmso.from('directions').select('*').eq('is_still_valid', true).order('created_at', { ascending: false }).limit(5),
    ]);

    const allGroups = (starredGroupsRes.data || []) as GroupWithStats[];
    const starred = allGroups.filter(g => g.is_starred);

    setStats({
      totalTasks: tasksRes.count || 0,
      overdueTasks: overdueRes.count || 0,
      completedToday: completedRes.count || 0,
      activeDirections: directionsRes.count || 0,
      totalMessages: messagesRes.count || 0,
      activeGroups: groupsCountRes.count || 0,
      monitoredGroups: starred.length,
    });
    setRecentTasks(recentTasksRes.data || []);
    setRecentDirections(recentDirsRes.data || []);
    setStarredGroups(starred);
  };

  useEffect(() => {
    if (!syncing) return;

    const interval = setInterval(async () => {
      const { data } = await hmso
        .from('sync_requests')
        .select('*')
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSyncRequest(data);
        if (data.status === 'completed' || data.status === 'failed') {
          setSyncing(false);
          if (data.status === 'completed') {
            refetchData();
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [syncing]);

  async function handleRefreshGroups() {
    setSyncing(true);
    const { data, error } = await hmso
      .from('sync_requests')
      .insert({ status: 'pending' })
      .select()
      .single();

    if (error) {
      console.error('Failed to create sync request:', error);
      setSyncing(false);
      return;
    }

    setSyncRequest(data);
  }

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

  const hasData = stats.totalTasks > 0 || stats.totalMessages > 0 || stats.activeGroups > 0;

  return (
    <div className="space-y-6 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">HMSO overview</p>
        </div>
        <button
          onClick={handleRefreshGroups}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Refresh Groups'}
        </button>
      </div>
      {syncRequest && syncing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <p className="text-sm text-blue-800">
            {syncRequest.status === 'pending' && 'Sync request queued...'}
            {syncRequest.status === 'processing' && 'Syncing groups from WhatsApp...'}
          </p>
        </div>
      )}
      {syncRequest && !syncing && syncRequest.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <p className="text-sm text-green-800">
            Synced {syncRequest.groups_synced} groups successfully
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Active Tasks" value={stats.totalTasks} icon={CheckSquare} color="blue" />
        <StatCard label="Overdue" value={stats.overdueTasks} icon={AlertTriangle} color="red" />
        <StatCard label="Completed Today" value={stats.completedToday} icon={CheckCircle2} color="emerald" />
        <StatCard label="Active Directions" value={stats.activeDirections} icon={Compass} color="teal" />
        <StatCard label="Total Messages" value={stats.totalMessages.toLocaleString()} icon={MessageSquare} color="blue" />
        <StatCard label="Monitored Groups" value={`${stats.monitoredGroups}/${stats.activeGroups}`} icon={Star} color="amber" />
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

          <div className="bg-white rounded-xl border lg:col-span-2">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h2 className="text-sm font-semibold text-gray-900">Monitored Groups</h2>
              </div>
              <Link to="/groups" className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {starredGroups.length === 0 ? (
              <div className="p-8 text-center">
                <Star className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No monitored groups yet</p>
                <p className="text-xs text-gray-400 mt-1">Star groups to monitor them here</p>
                <Link to="/groups" className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-3">
                  Go to Groups <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {starredGroups.slice(0, 5).map((group) => (
                  <Link key={group.id} to="/groups" className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{group.name}</p>
                        {group.today_message_count > 0 && (
                          <span className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3 h-3" />
                          {group.participant_count}
                        </span>
                        <span className={`flex items-center gap-1 text-xs ${group.today_message_count > 0 ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                          <MessageSquare className="w-3 h-3" />
                          {group.today_message_count} today
                        </span>
                        {group.total_message_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Database className="w-3 h-3" />
                            {group.total_message_count.toLocaleString()} total
                          </span>
                        )}
                        {group.flagged_count > 0 && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                            <Activity className="w-3 h-3" />
                            {group.flagged_count} important
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </Link>
                ))}
                {starredGroups.length > 5 && (
                  <div className="px-5 py-2 text-center">
                    <Link to="/groups" className="text-xs text-gray-500 hover:text-emerald-600">
                      +{starredGroups.length - 5} more monitored groups
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
