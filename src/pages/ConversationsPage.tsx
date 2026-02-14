import { useState, useEffect } from 'react';
import { MessageCircle, ArrowLeft, Search } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { ClassificationBadge } from '../components/StatusBadge';
import { hmso } from '../lib/supabase';
import type { Message, ClassifiedItem } from '../lib/types';

interface ContactSummary {
  wa_contact_jid: string;
  contact_name: string;
  message_count: number;
  last_message_time: string;
}

interface MessageWithClassification extends Message {
  classification?: ClassifiedItem;
}

const PAGE_SIZE = 100;

export default function ConversationsPage() {
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContact, setSelectedContact] = useState<ContactSummary | null>(null);
  const [messages, setMessages] = useState<MessageWithClassification[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadContacts();
  }, []);

  async function loadContacts() {
    setLoading(true);

    // Fetch personal messages grouped by contact
    const { data, error } = await hmso
      .from('messages')
      .select('wa_contact_jid, sender_name, timestamp, contacts:contact_id(display_name)')
      .eq('conversation_type', 'personal')
      .not('wa_contact_jid', 'is', null)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Failed to load personal messages:', error);
      setContacts([]);
      setLoading(false);
      return;
    }

    // Group by wa_contact_jid and compute summaries
    const contactMap = new Map<string, ContactSummary>();
    for (const row of (data || []) as Array<Record<string, unknown>>) {
      const jid = row.wa_contact_jid as string;
      if (!jid) continue;

      const existing = contactMap.get(jid);
      const contactObj = row.contacts as { display_name: string } | null;
      const name = contactObj?.display_name || (row.sender_name as string) || jid.split('@')[0];

      if (!existing) {
        contactMap.set(jid, {
          wa_contact_jid: jid,
          contact_name: name,
          message_count: 1,
          last_message_time: row.timestamp as string,
        });
      } else {
        existing.message_count++;
        // Keep the most recent name if we have a better one
        if (contactObj?.display_name && existing.contact_name === jid.split('@')[0]) {
          existing.contact_name = contactObj.display_name;
        }
      }
    }

    // Sort by most recent message
    const sorted = Array.from(contactMap.values()).sort(
      (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    );

    setContacts(sorted);
    setLoading(false);
  }

  async function loadContactMessages(contact: ContactSummary) {
    setSelectedContact(contact);
    setMessagesLoading(true);
    setMessages([]);
    setHasMore(true);

    const { count } = await hmso
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('wa_contact_jid', contact.wa_contact_jid)
      .eq('conversation_type', 'personal');

    setTotalCount(count || 0);

    const { data: msgData } = await hmso
      .from('messages')
      .select('*, classified_items(*)')
      .eq('wa_contact_jid', contact.wa_contact_jid)
      .eq('conversation_type', 'personal')
      .order('timestamp', { ascending: true })
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
  }

  async function loadMoreMessages() {
    if (!selectedContact || loadingMore || !hasMore) return;
    setLoadingMore(true);

    const { data: msgData } = await hmso
      .from('messages')
      .select('*, classified_items(*)')
      .eq('wa_contact_jid', selectedContact.wa_contact_jid)
      .eq('conversation_type', 'personal')
      .order('timestamp', { ascending: true })
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
  }

  const filteredContacts = searchQuery.trim()
    ? contacts.filter(c =>
        c.contact_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.wa_contact_jid.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (selectedContact) {
    return (
      <div className="space-y-5 fade-in">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedContact(null)}
            title="Back to contact list"
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedContact.contact_name}</h1>
            <p className="text-sm text-gray-500">
              {totalCount} messages | {selectedContact.wa_contact_jid.split('@')[0]}
            </p>
          </div>
        </div>

        {messagesLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">No messages yet</p>
        ) : (
          <div className="space-y-1">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`bg-white rounded-lg border px-4 py-3 hover:bg-gray-50 transition-colors ${
                  msg.is_from_hendra ? 'border-l-2 border-l-emerald-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-gray-900">
                        {msg.sender_name || msg.sender_jid}
                      </span>
                      {msg.is_from_hendra && (
                        <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                          Hendra
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {msg.message_text || `[${msg.message_type}]`}
                    </p>
                    {msg.classification && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <ClassificationBadge classification={msg.classification.classification} />
                        {msg.classification.summary && (
                          <span className="text-xs text-gray-500 truncate">{msg.classification.summary}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap">
                    {new Date(msg.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{' '}
                    {new Date(msg.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="mt-4 text-center">
                <button
                  onClick={loadMoreMessages}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loadingMore ? 'Loading...' : `Load More (${(totalCount - messages.length).toLocaleString()} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Direct Messages</h1>
        <p className="text-sm text-gray-500 mt-0.5">Personal WhatsApp conversations</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border px-4 py-3">
          <div className="text-2xl font-bold text-gray-900">{contacts.length}</div>
          <div className="text-xs text-gray-500">Contacts</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-100 px-4 py-3">
          <div className="text-2xl font-bold text-blue-700">
            {contacts.reduce((sum, c) => sum + c.message_count, 0)}
          </div>
          <div className="text-xs text-blue-600">Total Messages</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        />
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No personal messages yet"
          description="Direct messages will appear here once the listener starts capturing personal conversations."
        />
      ) : filteredContacts.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No results found"
          description={`No contacts matching "${searchQuery}"`}
        />
      ) : (
        <div className="bg-white rounded-xl border divide-y">
          {filteredContacts.map((contact) => (
            <div
              key={contact.wa_contact_jid}
              onClick={() => loadContactMessages(contact)}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-gray-900 truncate">{contact.contact_name}</h3>
                <p className="text-xs text-gray-500">{contact.message_count} messages</p>
              </div>
              <span className="text-[10px] text-gray-400 whitespace-nowrap">
                {new Date(contact.last_message_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}{' '}
                {new Date(contact.last_message_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
