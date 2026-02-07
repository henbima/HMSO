import { useEffect, useState } from 'react';
import { FileText, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import { waIntel } from '../lib/supabase';
import EmptyState from '../components/EmptyState';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBriefings();
  }, []);

  async function fetchBriefings() {
    try {
      const { data, error } = await waIntel
        .from('daily_briefings')
        .select('*')
        .order('briefing_date', { ascending: false })
        .limit(30);

      if (error) throw error;

      setBriefings(data || []);
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
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

  if (briefings.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="Belum Ada Briefing"
        description="Briefing harian akan muncul di sini setelah cron job berjalan"
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Daily Briefings</h1>
        <div className="text-sm text-gray-500">
          {briefings.length} briefing tersimpan
        </div>
      </div>

      <div className="space-y-4">
        {briefings.map((briefing) => (
          <div
            key={briefing.id}
            className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-emerald-300 transition-colors"
          >
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-semibold text-gray-900">
                    {formatDate(briefing.briefing_date)}
                  </h3>
                </div>
                <div className="text-xs text-gray-500">
                  Generated {new Date(briefing.created_at).toLocaleTimeString('id-ID')}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <div className="text-xs text-gray-500">Tugas Baru</div>
                  <div className="text-lg font-semibold text-blue-600">
                    {briefing.new_tasks_count}
                  </div>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <div className="text-xs text-gray-500">Terlambat</div>
                  <div className="text-lg font-semibold text-red-600">
                    {briefing.overdue_tasks_count}
                  </div>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <div className="text-xs text-gray-500">Selesai</div>
                  <div className="text-lg font-semibold text-green-600">
                    {briefing.completed_tasks_count}
                  </div>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-200">
                  <div className="text-xs text-gray-500">Arahan Baru</div>
                  <div className="text-lg font-semibold text-purple-600">
                    {briefing.new_directions_count}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                {briefing.summary_text}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
