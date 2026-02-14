import { useState, useEffect, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertTriangle,
  MessageSquare,
  ListTodo,
  Compass,
  FileText,
  Eye,
  Users,
  Flame,
} from 'lucide-react';
import { useGroupCategories } from '../hooks/useGroupCategories';
import { CategoryBadge } from './CategoryBadge';
import { hmso } from '../lib/supabase';
import type { GroupCategory } from '../services/group-category-service';

// --- Types ---

interface ParsedItem {
  group: string;
  text: string;
  assignee: string;
  status: 'selesai' | 'berlanjut' | 'menunggu' | 'terjawab' | 'none';
  overdueInfo?: string;
  messageCount?: number;
  topicCount?: number;
  signalType: SignalType;
}

type SignalType = 'task' | 'overdue' | 'direction' | 'attention' | 'report' | 'active' | 'group_activity';

interface CategoryCard {
  category: GroupCategory | null;
  priority: number;
  items: ParsedItem[];
  taskCount: number;
  directionCount: number;
  overdueCount: number;
  attentionCount: number;
  reportCount: number;
  activeCount: number;
  totalMessages: number;
  totalTopics: number;
}

// --- Color system for category cards ---

const categoryColorStyles: Record<string, {
  border: string; bg: string; headerBg: string; text: string; ring: string;
  badgeBg: string; badgeText: string;
}> = {
  emerald: {
    border: 'border-l-emerald-500', bg: 'bg-white', headerBg: 'bg-emerald-50/60',
    text: 'text-emerald-800', ring: 'ring-emerald-200',
    badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700',
  },
  blue: {
    border: 'border-l-blue-500', bg: 'bg-white', headerBg: 'bg-blue-50/60',
    text: 'text-blue-800', ring: 'ring-blue-200',
    badgeBg: 'bg-blue-100', badgeText: 'text-blue-700',
  },
  purple: {
    border: 'border-l-purple-500', bg: 'bg-white', headerBg: 'bg-purple-50/60',
    text: 'text-purple-800', ring: 'ring-purple-200',
    badgeBg: 'bg-purple-100', badgeText: 'text-purple-700',
  },
  amber: {
    border: 'border-l-amber-500', bg: 'bg-white', headerBg: 'bg-amber-50/60',
    text: 'text-amber-800', ring: 'ring-amber-200',
    badgeBg: 'bg-amber-100', badgeText: 'text-amber-700',
  },
  cyan: {
    border: 'border-l-cyan-500', bg: 'bg-white', headerBg: 'bg-cyan-50/60',
    text: 'text-cyan-800', ring: 'ring-cyan-200',
    badgeBg: 'bg-cyan-100', badgeText: 'text-cyan-700',
  },
  pink: {
    border: 'border-l-pink-500', bg: 'bg-white', headerBg: 'bg-pink-50/60',
    text: 'text-pink-800', ring: 'ring-pink-200',
    badgeBg: 'bg-pink-100', badgeText: 'text-pink-700',
  },
  orange: {
    border: 'border-l-orange-500', bg: 'bg-white', headerBg: 'bg-orange-50/60',
    text: 'text-orange-800', ring: 'ring-orange-200',
    badgeBg: 'bg-orange-100', badgeText: 'text-orange-700',
  },
  slate: {
    border: 'border-l-slate-400', bg: 'bg-white', headerBg: 'bg-slate-50/60',
    text: 'text-slate-700', ring: 'ring-slate-200',
    badgeBg: 'bg-slate-100', badgeText: 'text-slate-600',
  },
  gray: {
    border: 'border-l-gray-300', bg: 'bg-white', headerBg: 'bg-gray-50/60',
    text: 'text-gray-600', ring: 'ring-gray-200',
    badgeBg: 'bg-gray-100', badgeText: 'text-gray-500',
  },
};

function getCategoryStyle(color: string | undefined) {
  return categoryColorStyles[color || 'gray'] || categoryColorStyles.gray;
}

// --- Signal type config ---

const signalConfig: Record<SignalType, { icon: typeof ListTodo; label: string; color: string }> = {
  task: { icon: ListTodo, label: 'Task', color: 'text-blue-600' },
  overdue: { icon: AlertTriangle, label: 'Overdue', color: 'text-red-600' },
  direction: { icon: Compass, label: 'Arahan', color: 'text-teal-600' },
  attention: { icon: Eye, label: 'Perhatian', color: 'text-amber-600' },
  report: { icon: FileText, label: 'Laporan', color: 'text-purple-600' },
  active: { icon: RefreshCw, label: 'Aktif', color: 'text-indigo-600' },
  group_activity: { icon: MessageSquare, label: 'Aktivitas', color: 'text-gray-500' },
};

const statusConfig = {
  selesai: { label: 'Selesai', icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  berlanjut: { label: 'Berlanjut', icon: RefreshCw, className: 'text-blue-600 bg-blue-50 border-blue-200' },
  menunggu: { label: 'Menunggu', icon: Clock, className: 'text-amber-600 bg-amber-50 border-amber-200' },
  terjawab: { label: 'Terjawab', icon: CheckCircle2, className: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  none: { label: '', icon: Clock, className: '' },
};

// --- Parser ---

function detectSignalType(title: string): SignalType | null {
  const lower = title.toLowerCase();
  if (lower.includes('task')) return 'task';
  if (lower.includes('overdue') || lower.includes('no response')) return 'overdue';
  if (lower.includes('arahan')) return 'direction';
  if (lower.includes('butuh perhatian') || lower.includes('perlu perhatian')) return 'attention';
  if (lower.includes('laporan')) return 'report';
  if (lower.includes('percakapan aktif')) return 'active';
  if (lower.includes('aktivitas grup')) return 'group_activity';
  return null;
}

function parseStatus(statusLine: string): ParsedItem['status'] {
  if (statusLine.includes('SELESAI')) return 'selesai';
  if (statusLine.includes('BERLANJUT')) return 'berlanjut';
  if (statusLine.includes('MENUNGGU')) return 'menunggu';
  if (statusLine.includes('TERJAWAB')) return 'terjawab';
  return 'none';
}

export function parseBriefingSummary(text: string): {
  headerLine: string;
  statsLine: string;
  items: ParsedItem[];
} {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let headerLine = '';
  let statsLine = '';
  const items: ParsedItem[] = [];
  let currentSignalType: SignalType | null = null;
  let currentItem: ParsedItem | null = null;

  for (const line of lines) {
    // Header line
    if (line.startsWith('📊')) {
      headerLine = line.replace('📊', '').trim();
      continue;
    }

    // Stats line
    if (line.startsWith('📈')) {
      statsLine = line.replace('📈', '').replace('Ringkasan:', '').trim();
      continue;
    }

    // Section headers — detect signal type
    // Match lines starting with known section emojis
    const isSectionHeader = /^(?:\u{1F195}|\u26A0\uFE0F|\u{1F4DD}|\u{1F4CB}|\u{1F504}|\u{1F4AC}|\u{1F441}\uFE0F)\s/u.test(line);
    if (isSectionHeader) {
      // Flush current item
      if (currentItem) {
        items.push(currentItem);
        currentItem = null;
      }

      // Strip leading emoji(s) and trailing colon
      const titlePart = line.replace(/^(?:\u{1F195}|\u26A0\uFE0F|\u{1F4DD}|\u{1F4CB}|\u{1F504}|\u{1F4AC}|\u{1F441}\uFE0F)\s*/u, '').replace(/:?\s*$/, '');
      const cleanTitle = titlePart.replace(/\s*\(\d+\)/, '').trim();
      currentSignalType = detectSignalType(cleanTitle || titlePart);
      continue;
    }

    // Bullet items
    if (line.startsWith('•') && currentSignalType) {
      if (currentItem) {
        items.push(currentItem);
      }

      const content = line.replace(/^•\s*/, '');

      // Group activity line: "Group Name: 63 pesan, 3 topik penting"
      if (currentSignalType === 'group_activity') {
        const match = content.match(/^(.+?):\s*(\d+)\s*pesan,\s*(\d+)\s*topik penting$/);
        if (match) {
          currentItem = null;
          items.push({
            group: match[1].trim(),
            text: '',
            assignee: '',
            status: 'none',
            messageCount: parseInt(match[2]),
            topicCount: parseInt(match[3]),
            signalType: 'group_activity',
          });
          continue;
        }
      }

      // Standard item: "[Group Name] Description → @Assignee"
      const groupMatch = content.match(/^\[(.+?)\]\s*/);
      const group = groupMatch ? groupMatch[1] : '';
      const rest = groupMatch ? content.replace(groupMatch[0], '') : content;
      const parts = rest.split('→');
      const itemText = parts[0].trim();
      const assignee = parts[1]?.trim().replace(/^@/, '') || '';
      const overdueMatch = assignee.match(/\((\d+\s*hari)\)/);

      currentItem = {
        group,
        text: itemText,
        assignee: assignee.replace(/\s*\(\d+\s*hari\)/, '').trim(),
        status: 'none',
        overdueInfo: overdueMatch ? overdueMatch[1] : undefined,
        signalType: currentSignalType,
      };
      continue;
    }

    // Status lines
    if ((line.startsWith('✅') || line.startsWith('⏳') || line.startsWith('🔄')) && currentItem) {
      currentItem.status = parseStatus(line);
      continue;
    }
  }

  // Flush remaining
  if (currentItem) {
    items.push(currentItem);
  }

  return { headerLine, statsLine, items };
}

// --- Build category cards from flat items ---

function buildCategoryCards(
  items: ParsedItem[],
  groupCategoryMap: Record<string, GroupCategory>,
): CategoryCard[] {
  const cardMap = new Map<string | null, CategoryCard>();

  for (const item of items) {
    const category = groupCategoryMap[item.group] || null;
    const categoryId = category?.id || null;

    if (!cardMap.has(categoryId)) {
      cardMap.set(categoryId, {
        category,
        priority: category?.briefing_priority || 9,
        items: [],
        taskCount: 0,
        directionCount: 0,
        overdueCount: 0,
        attentionCount: 0,
        reportCount: 0,
        activeCount: 0,
        totalMessages: 0,
        totalTopics: 0,
      });
    }

    const card = cardMap.get(categoryId)!;
    card.items.push(item);

    switch (item.signalType) {
      case 'task': card.taskCount++; break;
      case 'overdue': card.overdueCount++; break;
      case 'direction': card.directionCount++; break;
      case 'attention': card.attentionCount++; break;
      case 'report': card.reportCount++; break;
      case 'active': card.activeCount++; break;
      case 'group_activity':
        card.totalMessages += item.messageCount || 0;
        card.totalTopics += item.topicCount || 0;
        break;
    }
  }

  const cards = Array.from(cardMap.values());
  cards.sort((a, b) => a.priority - b.priority);
  return cards;
}

// --- UI Components ---

function StatusBadge({ status }: { status: ParsedItem['status'] }) {
  if (status === 'none') return null;
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full border ${config.className}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function SignalBadge({ type, count }: { type: SignalType; count: number }) {
  if (count === 0) return null;
  const config = signalConfig[type];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      <span>{count}</span>
    </span>
  );
}

function ItemRow({ item }: { item: ParsedItem }) {
  const signal = signalConfig[item.signalType];
  const SignalIcon = signal.icon;

  return (
    <div className="flex items-start gap-2.5 py-2 px-3 hover:bg-gray-50/80 transition-colors">
      <SignalIcon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${signal.color}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {item.group && (
            <span className="text-xs text-gray-400 font-medium">{item.group}</span>
          )}
          <StatusBadge status={item.status} />
          {item.overdueInfo && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium text-red-600 bg-red-50 rounded border border-red-200">
              {item.overdueInfo}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">{item.text}</p>
        {item.assignee && (
          <div className="flex items-center gap-1 mt-1">
            <Users className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-500">{item.assignee}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Overdue Alert Banner ---

function OverdueAlertBanner({ items }: { items: ParsedItem[] }) {
  const [isOpen, setIsOpen] = useState(true);
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-red-200 bg-red-50/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-red-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-red-700">
            Butuh Tindakan
          </span>
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
            {items.length}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-red-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-red-400" />
        )}
      </button>
      {isOpen && (
        <div className="bg-white divide-y divide-red-100 border-t border-red-200">
          {items.map((item, i) => (
            <ItemRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Category Command Card ---

function CategoryCommandCard({ card, defaultOpen }: { card: CategoryCard; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const style = getCategoryStyle(card.category?.color);
  // Exclude overdue/attention (shown in alert banner) and group_activity from body
  const displayItems = card.items.filter(
    i => i.signalType !== 'group_activity' && i.signalType !== 'overdue' && i.signalType !== 'attention'
  );
  const hasContent = displayItems.length > 0;

  if (!hasContent && card.totalMessages === 0) return null;

  return (
    <div className={`rounded-xl border border-gray-200 ${style.bg} border-l-4 ${style.border} overflow-hidden`}>
      {/* Card Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-4 py-3 ${style.headerBg} hover:brightness-[0.97] transition-all`}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CategoryBadge category={card.category} size="md" />
          </div>
          {/* Signal counts as mini badges */}
          <div className="flex items-center gap-2.5">
            <SignalBadge type="task" count={card.taskCount} />
            <SignalBadge type="direction" count={card.directionCount} />
            <SignalBadge type="overdue" count={card.overdueCount} />
            <SignalBadge type="attention" count={card.attentionCount} />
            <SignalBadge type="report" count={card.reportCount} />
            <SignalBadge type="active" count={card.activeCount} />
          </div>
        </div>
        <div className="flex items-center gap-3">
          {card.totalMessages > 0 && (
            <span className="text-xs text-gray-400">
              {card.totalMessages} pesan
            </span>
          )}
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* Card Body — items (excluding urgent, shown in alert banner) */}
      {isOpen && hasContent && (
        <div className="bg-white divide-y divide-gray-100 border-t border-gray-100">
          {displayItems.map((item, i) => (
            <ItemRow key={i} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Collapsed tier ---

function CollapsedTier({
  label,
  cards,
  defaultOpen,
}: {
  label: string;
  cards: CategoryCard[];
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const totalItems = cards.reduce((sum, c) => sum + c.items.filter(
    i => i.signalType !== 'group_activity' && i.signalType !== 'overdue' && i.signalType !== 'attention'
  ).length, 0);

  if (cards.length === 0 || totalItems === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
      >
        <span>{label} ({totalItems} item)</span>
        {isOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-2">
          {cards.map((card, i) => (
            <CategoryCommandCard key={i} card={card} defaultOpen={defaultOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Main Export ---

export default function BriefingSummaryRenderer({ summaryText }: { summaryText: string }) {
  const { headerLine, statsLine, items } = parseBriefingSummary(summaryText);
  const { categories, categoryMap } = useGroupCategories();
  const [groupCategoryMap, setGroupCategoryMap] = useState<Record<string, GroupCategory>>({});
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  // Fetch groups and build group name → category mapping
  useEffect(() => {
    async function loadGroupCategories() {
      if (!categories || categories.length === 0) return;

      try {
        const { data: groups, error } = await hmso
          .from('groups')
          .select('name, category_id')
          .not('category_id', 'is', null);

        if (error) {
          console.error('Error fetching groups for category mapping:', error);
          setCategoriesLoaded(true);
          return;
        }

        if (groups) {
          const mapping: Record<string, GroupCategory> = {};
          groups.forEach((group: { name: string; category_id: string }) => {
            if (group.category_id && categoryMap[group.category_id]) {
              mapping[group.name] = categoryMap[group.category_id];
            }
          });
          setGroupCategoryMap(mapping);
        }
        setCategoriesLoaded(true);
      } catch (error) {
        console.error('Error loading group categories:', error);
        setCategoriesLoaded(true);
      }
    }

    loadGroupCategories();
  }, [categories, categoryMap]);

  // Build category cards once data is ready — exclude overdue/attention (shown in alert banner)
  const categoryCards = useMemo(() => {
    if (!categoriesLoaded || Object.keys(groupCategoryMap).length === 0) return null;
    return buildCategoryCards(items, groupCategoryMap);
  }, [items, groupCategoryMap, categoriesLoaded]);

  // Extract overdue + attention items for the alert banner
  const urgentItems = useMemo(() => {
    return items.filter(i => i.signalType === 'overdue' || i.signalType === 'attention');
  }, [items]);

  if (!items.length && !headerLine) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
          {summaryText}
        </pre>
      </div>
    );
  }

  // Parse stats
  const stats = statsLine.split(',').map(s => s.trim()).filter(Boolean);

  // If categories aren't loaded yet, show a simple loading state
  if (!categoryCards) {
    return (
      <div className="space-y-3">
        {stats.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-1">
            {stats.map((stat, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
                {stat}
              </span>
            ))}
          </div>
        )}
        <div className="text-sm text-gray-400 px-1">Memuat kategori...</div>
      </div>
    );
  }

  // Split cards by priority tier
  const highPriority = categoryCards.filter(c => c.priority >= 1 && c.priority <= 3);
  const mediumPriority = categoryCards.filter(c => c.priority >= 4 && c.priority <= 6);
  const lowPriority = categoryCards.filter(c => c.priority >= 7 && c.priority <= 9);

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      {stats.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {stats.map((stat, i) => (
            <span key={i} className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
              {stat}
            </span>
          ))}
        </div>
      )}

      {/* 🔥 Urgent items — overdue + attention, pulled to top */}
      <OverdueAlertBanner items={urgentItems} />

      {/* High priority categories (1-3) — expanded */}
      {highPriority.map((card, i) => (
        <CategoryCommandCard key={`high-${i}`} card={card} defaultOpen={true} />
      ))}

      {/* Medium priority (4-6) — collapsed tier */}
      <CollapsedTier label="Prioritas Menengah" cards={mediumPriority} defaultOpen={false} />

      {/* Low priority (7-9) — collapsed tier */}
      <CollapsedTier label="Lainnya" cards={lowPriority} defaultOpen={false} />
    </div>
  );
}
