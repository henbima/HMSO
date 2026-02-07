import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Users, ChevronRight, ArrowLeft, Search, Star, SortAsc, Activity, LayoutGrid, List, Database } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { ClassificationBadge } from '../components/StatusBadge';
import { waIntel } from '../lib/supabase';
import type { Group, Message, ClassifiedItem } from '../lib/types';

interface GroupWithStats extends Group {
  today_message_count: number;
  total_message_count: number;
  flagged_count: number;
}

interface MessageWithClassification extends Message {
  classification?: ClassifiedItem;
}

type SortOption = 'name' | 'activity' | 'members' | 'recent';

const PAGE_SIZE = 100;

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithStats | null>(null);
  const [messages, setMessages] = useState<MessageWithClassification[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('activity');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadGroups();
  }, []);

  async function loadGroups() {
    setLoading(true);
    const { data, error } = await waIntel.rpc('get_groups_with_today_stats');

    if (error) {
      console.error('Failed to load groups:', error);
      setGroups([]);
      setLoading(false);
      return;
    }

    setGroups((data || []) as GroupWithStats[]);
    setLoading(false);
  }

  const toggleStar = async (e: React.MouseEvent, group: GroupWithStats) => {
    e.stopPropagation();
    const newStarred = !group.is_starred;

    setGroups(prev => prev.map(g =>
      g.id === group.id ? { ...g, is_starred: newStarred } : g
    ));

    await waIntel
      .from('groups')
      .update({ is_starred: newStarred })
      .eq('id', group.id);
  };

  const filteredAndSortedGroups = useMemo(() => {
    let result = [...groups];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(query) ||
        (g.description?.toLowerCase().includes(query))
      );
    }

    result.sort((a, b) => {
      if (a.is_starred && !b.is_starred) return -1;
      if (!a.is_starred && b.is_starred) return 1;

      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'activity':
          return b.today_message_count - a.today_message_count;
        case 'members':
          return b.participant_count - a.participant_count;
        case 'recent':
          return b.today_message_count - a.today_message_count;
        default:
          return 0;
      }
    });

    return result;
  }, [groups, searchQuery, sortBy]);

  const starredGroups = filteredAndSortedGroups.filter(g => g.is_starred);
  const otherGroups = filteredAndSortedGroups.filter(g => !g.is_starred);

  const stats = useMemo(() => ({
    total: groups.length,
    starred: groups.filter(g => g.is_starred).length,
    activeToday: groups.filter(g => g.today_message_count > 0).length,
    totalMessages: groups.reduce((sum, g) => sum + g.today_message_count, 0),
  }), [groups]);

  const loadGroupMessages = async (group: GroupWithStats) => {
    setSelectedGroup(group);
    setMessagesLoading(true);
    setMessages([]);
    setHasMore(true);

    const { count } = await waIntel
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('wa_group_id', group.wa_group_id);

    setTotalCount(count || 0);

    const { data: msgData } = await waIntel
      .from('messages')
      .select('*, classified_items(*)')
      .eq('wa_group_id', group.wa_group_id)
      .order('timestamp', { ascending: false })
      .limit(PAGE_SIZE);

    const enriched: MessageWithClassification[] = (msgData || []).map((m: Record<string, unknown>) => {
      const ci = m.classified_items;
      return {
        ...m,
        classification: Array.isArray(ci) && ci.length > 0 ? ci[0] : undefined,
      } as MessageWithClassification;
    });

    setMessages(enriched);
    setHasMore(enriched.length === PAGE_SIZE);
    setMessagesLoading(false);
  };

  const loadMoreMessages = async () => {
    if (!selectedGroup || loadingMore || !hasMore) return;

    setLoadingMore(true);

    const { data: msgData } = await waIntel
      .from('messages')
      .select('*, classified_items(*)')
      .eq('wa_group_id', selectedGroup.wa_group_id)
      .order('timestamp', { ascending: false })
      .range(messages.length, messages.length + PAGE_SIZE - 1);

    const enriched: MessageWithClassification[] = (msgData || []).map((m: Record<string, unknown>) => {
      const ci = m.classified_items;
      return {
        ...m,
        classification: Array.isArray(ci) && ci.length > 0 ? ci[0] : undefined,
      } as MessageWithClassification;
    });

    setMessages(prev => [...prev, ...enriched]);
    setHasMore(enriched.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedGroup) {
    return (
      <GroupDetail
        group={selectedGroup}
        messages={messages}
        loading={messagesLoading}
        onBack={() => setSelectedGroup(null)}
        totalCount={totalCount}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={loadMoreMessages}
        onToggleStar={(e) => toggleStar(e, selectedGroup)}
      />
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Groups</h1>
          <p className="text-sm text-gray-500 mt-0.5">WhatsApp group activity overview</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border px-4 py-3">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-xs text-gray-500">Total Groups</div>
        </div>
        <div className="bg-amber-50 rounded-lg border border-amber-100 px-4 py-3">
          <div className="text-2xl font-bold text-amber-700">{stats.starred}</div>
          <div className="text-xs text-amber-600">Monitored</div>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-100 px-4 py-3">
          <div className="text-2xl font-bold text-emerald-700">{stats.activeToday}</div>
          <div className="text-xs text-emerald-600">Active Today</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-100 px-4 py-3">
          <div className="text-2xl font-bold text-blue-700">{stats.totalMessages}</div>
          <div className="text-xs text-blue-600">Messages Today</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <SortAsc className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="pl-10 pr-8 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 appearance-none cursor-pointer"
            >
              <option value="activity">Most Active</option>
              <option value="name">Name A-Z</option>
              <option value="members">Most Members</option>
            </select>
          </div>
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2.5 ${viewMode === 'grid' ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2.5 ${viewMode === 'list' ? 'bg-emerald-50 text-emerald-600' : 'bg-white text-gray-400 hover:text-gray-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No groups yet"
          description="Groups will appear here once the Baileys listener connects and starts monitoring WhatsApp groups."
        />
      ) : filteredAndSortedGroups.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results found"
          description={`No groups matching "${searchQuery}"`}
        />
      ) : (
        <div className="space-y-6">
          {starredGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h2 className="text-sm font-semibold text-gray-700">Monitored Groups</h2>
                <span className="text-xs text-gray-400">({starredGroups.length})</span>
              </div>
              <GroupGrid
                groups={starredGroups}
                viewMode={viewMode}
                onSelect={loadGroupMessages}
                onToggleStar={toggleStar}
              />
            </div>
          )}

          {otherGroups.length > 0 && (
            <div>
              {starredGroups.length > 0 && (
                <h2 className="text-sm font-semibold text-gray-700 mb-3">
                  All Groups <span className="text-xs text-gray-400 font-normal">({otherGroups.length})</span>
                </h2>
              )}
              <GroupGrid
                groups={otherGroups}
                viewMode={viewMode}
                onSelect={loadGroupMessages}
                onToggleStar={toggleStar}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupGrid({
  groups,
  viewMode,
  onSelect,
  onToggleStar,
}: {
  groups: GroupWithStats[];
  viewMode: 'grid' | 'list';
  onSelect: (group: GroupWithStats) => void;
  onToggleStar: (e: React.MouseEvent, group: GroupWithStats) => void;
}) {
  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-xl border divide-y">
        {groups.map((group) => (
          <div
            key={group.id}
            onClick={() => onSelect(group)}
            className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <button
              onClick={(e) => onToggleStar(e, group)}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <Star className={`w-4 h-4 ${group.is_starred ? 'text-amber-500 fill-amber-500' : 'text-gray-300 hover:text-gray-400'}`} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-gray-900 truncate">{group.name}</h3>
                {group.today_message_count > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                    <Activity className="w-3 h-3" />
                    Active
                  </span>
                )}
              </div>
              {group.description && (
                <p className="text-xs text-gray-500 truncate">{group.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>{group.participant_count} members</span>
              <span className={group.today_message_count > 0 ? 'text-emerald-600 font-medium' : ''}>{group.today_message_count} today</span>
              {group.total_message_count > 0 && (
                <span className="text-gray-400">{group.total_message_count.toLocaleString()} total</span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  );
}

function GroupCard({
  group,
  onSelect,
  onToggleStar,
}: {
  group: GroupWithStats;
  onSelect: (group: GroupWithStats) => void;
  onToggleStar: (e: React.MouseEvent, group: GroupWithStats) => void;
}) {
  const hasActivity = group.today_message_count > 0;

  return (
    <div
      onClick={() => onSelect(group)}
      className={`bg-white rounded-xl border p-5 hover:shadow-sm transition-all cursor-pointer group relative ${
        group.is_starred ? 'border-amber-200 bg-amber-50/30' : 'hover:border-emerald-200'
      }`}
    >
      <button
        onClick={(e) => onToggleStar(e, group)}
        className="absolute top-3 right-3 p-1.5 hover:bg-white/80 rounded-lg transition-colors z-10"
      >
        <Star className={`w-4 h-4 ${group.is_starred ? 'text-amber-500 fill-amber-500' : 'text-gray-300 hover:text-gray-400'}`} />
      </button>

      <div className="flex items-start justify-between pr-8">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 truncate">{group.name}</h3>
            {hasActivity && (
              <span className="flex-shrink-0 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </div>
          {group.description && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{group.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-4">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">{group.participant_count} members</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MessageSquare className={`w-3.5 h-3.5 ${hasActivity ? 'text-emerald-500' : 'text-gray-400'}`} />
          <span className={`text-xs ${hasActivity ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
            {group.today_message_count} today
          </span>
        </div>
        {group.total_message_count > 0 && (
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">{group.total_message_count.toLocaleString()} total</span>
          </div>
        )}
      </div>

      {group.flagged_count > 0 && (
        <div className="mt-3 pt-3 border-t">
          <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
            {group.flagged_count} important messages today
          </span>
        </div>
      )}

      <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-emerald-500" />
      </div>
    </div>
  );
}

function GroupDetail({
  group,
  messages,
  loading,
  onBack,
  totalCount,
  hasMore,
  loadingMore,
  onLoadMore,
  onToggleStar,
}: {
  group: GroupWithStats;
  messages: MessageWithClassification[];
  loading: boolean;
  onBack: () => void;
  totalCount: number;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onToggleStar: (e: React.MouseEvent) => void;
}) {
  const importantMessages = messages.filter(
    (m) => m.classification && !['noise', 'coordination'].includes(m.classification.classification)
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
              {group.is_starred && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              )}
            </div>
            <p className="text-sm text-gray-500">
              {group.participant_count} members | {totalCount.toLocaleString()} total messages | Showing {messages.length}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleStar}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            group.is_starred
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Star className={`w-4 h-4 ${group.is_starred ? 'fill-amber-500' : ''}`} />
          {group.is_starred ? 'Monitored' : 'Monitor'}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {importantMessages.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Important Messages</h2>
              <div className="space-y-2">
                {importantMessages.map((msg) => (
                  <MessageRow key={msg.id} message={msg} />
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">All Messages</h2>
            {messages.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">No messages yet</p>
            ) : (
              <div className="space-y-1">
                {messages.map((msg) => (
                  <MessageRow key={msg.id} message={msg} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={onLoadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMore ? 'Loading...' : `Load More (${(totalCount - messages.length).toLocaleString()} remaining)`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: MessageWithClassification }) {
  const time = new Date(message.timestamp).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const date = new Date(message.timestamp).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className={`bg-white rounded-lg border px-4 py-3 hover:bg-gray-50 transition-colors ${
      message.is_from_hendra ? 'border-l-2 border-l-emerald-500' : ''
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-gray-900">
              {message.sender_name || message.sender_jid}
            </span>
            {message.is_from_hendra && (
              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                Owner
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            {message.message_text || `[${message.message_type}]`}
          </p>
          {message.classification && (
            <div className="flex items-center gap-2 mt-1.5">
              <ClassificationBadge classification={message.classification.classification} />
              {message.classification.summary && (
                <span className="text-xs text-gray-500 truncate">{message.classification.summary}</span>
              )}
            </div>
          )}
        </div>
        <span className="text-[10px] text-gray-400 whitespace-nowrap">
          {date} {time}
        </span>
      </div>
    </div>
  );
}
