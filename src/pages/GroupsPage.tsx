import { useState, useEffect } from 'react';
import { MessageSquare, Users, ChevronRight, ArrowLeft } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { ClassificationBadge } from '../components/StatusBadge';
import { waIntel } from '../lib/supabase';
import type { Group, Message, ClassifiedItem } from '../lib/types';

interface GroupWithStats extends Group {
  today_message_count: number;
  flagged_count: number;
}

interface MessageWithClassification extends Message {
  classification?: ClassifiedItem;
}

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithStats | null>(null);
  const [messages, setMessages] = useState<MessageWithClassification[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  useEffect(() => {
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

    loadGroups();
  }, []);

  const loadGroupMessages = async (group: GroupWithStats) => {
    setSelectedGroup(group);
    setMessagesLoading(true);

    const { data: msgData } = await waIntel
      .from('messages')
      .select('*, classified_items(*)')
      .eq('wa_group_id', group.wa_group_id)
      .order('timestamp', { ascending: false })
      .limit(50);

    const enriched: MessageWithClassification[] = (msgData || []).map((m: Record<string, unknown>) => {
      const ci = m.classified_items;
      return {
        ...m,
        classification: Array.isArray(ci) && ci.length > 0 ? ci[0] : undefined,
      } as MessageWithClassification;
    });

    setMessages(enriched);
    setMessagesLoading(false);
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
      />
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Groups</h1>
        <p className="text-sm text-gray-500 mt-0.5">WhatsApp group activity overview</p>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No groups yet"
          description="Groups will appear here once the Baileys listener connects and starts monitoring WhatsApp groups."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              onClick={() => loadGroupMessages(group)}
              className="bg-white rounded-xl border p-5 hover:shadow-sm hover:border-emerald-200 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{group.description}</p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-0.5" />
              </div>

              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">{group.participant_count} members</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-500">{group.today_message_count} today</span>
                </div>
              </div>

              {group.flagged_count > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    {group.flagged_count} important messages today
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupDetail({
  group,
  messages,
  loading,
  onBack,
}: {
  group: GroupWithStats;
  messages: MessageWithClassification[];
  loading: boolean;
  onBack: () => void;
}) {
  const importantMessages = messages.filter(
    (m) => m.classification && !['noise', 'coordination'].includes(m.classification.classification)
  );

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{group.name}</h1>
          <p className="text-sm text-gray-500">
            {group.participant_count} members | {messages.length} recent messages
          </p>
        </div>
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
