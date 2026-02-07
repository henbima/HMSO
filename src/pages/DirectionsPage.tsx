import { useState, useEffect, useCallback } from 'react';
import { Compass, Search, X, ChevronDown, ChevronUp, CheckCircle2, XCircle } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { waIntel } from '../lib/supabase';
import type { Direction } from '../lib/types';

export default function DirectionsPage() {
  const [directions, setDirections] = useState<Direction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTopic, setFilterTopic] = useState('');
  const [showValid, setShowValid] = useState<boolean | null>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDirections = useCallback(async () => {
    setLoading(true);
    let query = waIntel
      .from('directions')
      .select('*')
      .order('created_at', { ascending: false });

    if (showValid !== null) {
      query = query.eq('is_still_valid', showValid);
    }
    if (filterTopic) {
      query = query.eq('topic', filterTopic);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,content.ilike.%${search}%`);
    }

    const { data } = await query;
    setDirections(data || []);
    setLoading(false);
  }, [search, filterTopic, showValid]);

  useEffect(() => {
    fetchDirections();
  }, [fetchDirections]);

  const toggleValidity = async (id: string, current: boolean) => {
    await waIntel.from('directions').update({
      is_still_valid: !current,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    fetchDirections();
  };

  const topics = [...new Set(directions.map((d) => d.topic).filter(Boolean))];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Directions</h1>
        <p className="text-sm text-gray-500 mt-0.5">Leadership directives and policy knowledge base</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search directions..."
            className="w-full pl-9 pr-8 py-2 rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-3 h-3 text-gray-400" />
            </button>
          )}
        </div>

        {topics.length > 0 && (
          <select
            value={filterTopic}
            onChange={(e) => setFilterTopic(e.target.value)}
            className="rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All topics</option>
            {topics.map((t) => (
              <option key={t} value={t!}>{t}</option>
            ))}
          </select>
        )}

        <div className="flex rounded-lg border overflow-hidden">
          {[
            { label: 'Active', value: true },
            { label: 'All', value: null },
            { label: 'Archived', value: false },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setShowValid(opt.value)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${
                showValid === opt.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {directions.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No directions found"
          description={search || filterTopic ? 'Try adjusting your search or filters.' : 'Directions from leadership will appear here once the AI classifier identifies them from WhatsApp messages.'}
        />
      ) : (
        <div className="space-y-2">
          {directions.map((dir) => (
            <DirectionCard
              key={dir.id}
              direction={dir}
              isExpanded={expandedId === dir.id}
              onToggle={() => setExpandedId(expandedId === dir.id ? null : dir.id)}
              onToggleValidity={() => toggleValidity(dir.id, dir.is_still_valid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DirectionCard({
  direction,
  isExpanded,
  onToggle,
  onToggleValidity,
}: {
  direction: Direction;
  isExpanded: boolean;
  onToggle: () => void;
  onToggleValidity: () => void;
}) {
  const date = new Date(direction.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      className={`bg-white rounded-xl border transition-all ${
        !direction.is_still_valid ? 'opacity-60' : ''
      }`}
    >
      <div
        className="px-5 py-4 flex items-start justify-between gap-3 cursor-pointer hover:bg-gray-50 transition-colors rounded-t-xl"
        onClick={onToggle}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            {direction.is_still_valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
            )}
            <h3 className="text-sm font-semibold text-gray-900 truncate">{direction.title}</h3>
          </div>
          <div className="flex items-center flex-wrap gap-2 pl-6">
            {direction.topic && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                {direction.topic}
              </span>
            )}
            {direction.target_audience && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
                {direction.target_audience}
              </span>
            )}
            {direction.group_name && (
              <span className="text-xs text-gray-500">{direction.group_name}</span>
            )}
            <span className="text-xs text-gray-400">{date}</span>
          </div>
        </div>
        <div className="flex-shrink-0 mt-1">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-5 pb-4 border-t">
          <div className="pt-4 pl-6">
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {direction.content}
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleValidity();
                }}
                className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                  direction.is_still_valid
                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                {direction.is_still_valid ? 'Mark as Archived' : 'Reactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
