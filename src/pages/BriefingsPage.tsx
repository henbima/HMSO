import { useEffect, useState } from 'react';
import {
  FileText,
  Calendar,
  AlertCircle,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckSquare,
  AlertTriangle,
  Compass,
  ListTodo,
} from 'lucide-react';
import { hmso, supabase } from '../lib/supabase';
import EmptyState from '../components/EmptyState';
import BriefingSummaryRenderer from '../components/BriefingSummaryRenderer';

interface Briefing {
  id: string;
  briefing_date: string;
  summary_text: string;
  new_tasks_count: number;
  overdue_tasks_count: number;
  completed_tasks_count: number;
  new_directions_count: number;
  sent_via: string | null;
  created_at: string;
}

export default function BriefingsPage() {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchBriefings();
  }, []);

  async function generateBriefing() {
    setGenerating(true);
    setGenerateError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-briefing`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to generate briefing');
      }

      const result = await response.json();
      if (result.briefing?.id) {
        setExpandedId(result.briefing.id);
      }
      await fetchBriefings();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setGenerating(false);
    }
  }

  async function fetchBriefings() {
    try {
      const { data, error } = await hmso
        .from('daily_briefings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setBriefings(data || []);
      if (data && data.length > 0 && !expandedId) {
        setExpandedId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load briefings');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function isToday(dateStr: string): boolean {
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Briefings</h1>
          <p className="text-sm text-gray-500 mt-1">
            {briefings.length} briefing tersimpan
          </p>
        </div>
        <button
          type="button"
          onClick={generateBriefing}
          disabled={generating}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {generating ? 'Generating...' : 'Generate Briefing'}
        </button>
      </div>

      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="w-5 h-5" />
            <p>{generateError}</p>
          </div>
        </div>
      )}

      {briefings.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Belum Ada Briefing"
          description="Klik tombol 'Generate Briefing' untuk membuat briefing pertama Anda"
        />
      ) : (
        <div className="space-y-3">
          {briefings.map((briefing) => {
            const isExpanded = expandedId === briefing.id;
            const todayBriefing = isToday(briefing.created_at);

            return (
              <div
                key={briefing.id}
                className={`bg-white rounded-xl border transition-all duration-200 ${
                  isExpanded ? 'border-emerald-300 shadow-md' : 'border-gray-200 hover:border-gray-300'
                } ${todayBriefing && !isExpanded ? 'ring-2 ring-emerald-100' : ''}`}
              >
                {/* Collapsed header — always visible */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : briefing.id)}
                  className="w-full text-left"
                >
                  <div className="px-5 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${todayBriefing ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                        <Calendar className={`w-5 h-5 ${todayBriefing ? 'text-emerald-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900">
                            {formatDate(briefing.briefing_date)}
                          </h3>
                          {todayBriefing && (
                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                              Hari Ini
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Dibuat pukul {formatTime(briefing.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-blue-600" title="Tugas Baru">
                          <ListTodo className="w-4 h-4" />
                          <span>{briefing.new_tasks_count}</span>
                        </div>
                        {briefing.overdue_tasks_count > 0 && (
                          <div className="flex items-center gap-1 text-red-600" title="Terlambat">
                            <AlertTriangle className="w-4 h-4" />
                            <span>{briefing.overdue_tasks_count}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-green-600" title="Selesai">
                          <CheckSquare className="w-4 h-4" />
                          <span>{briefing.completed_tasks_count}</span>
                        </div>
                        <div className="flex items-center gap-1 text-teal-600" title="Arahan Baru">
                          <Compass className="w-4 h-4" />
                          <span>{briefing.new_directions_count}</span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-gray-200">
                    {/* Stat boxes */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-gradient-to-r from-gray-50 to-slate-50">
                      <StatBox label="Tugas Baru" value={briefing.new_tasks_count} color="blue" icon={ListTodo} />
                      <StatBox label="Terlambat" value={briefing.overdue_tasks_count} color="red" icon={AlertTriangle} />
                      <StatBox label="Selesai" value={briefing.completed_tasks_count} color="green" icon={CheckSquare} />
                      <StatBox label="Arahan Baru" value={briefing.new_directions_count} color="teal" icon={Compass} />
                    </div>

                    {/* Parsed summary */}
                    <div className="px-5 py-4">
                      <BriefingSummaryRenderer summaryText={briefing.summary_text} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'blue' | 'red' | 'green' | 'teal';
  icon: React.ComponentType<{ className?: string }>;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-100 text-blue-600',
    red: 'bg-red-50 border-red-100 text-red-600',
    green: 'bg-green-50 border-green-100 text-green-600',
    teal: 'bg-teal-50 border-teal-100 text-teal-600',
  };

  return (
    <div className={`rounded-lg px-3 py-2.5 border ${colorClasses[color]}`}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
}
