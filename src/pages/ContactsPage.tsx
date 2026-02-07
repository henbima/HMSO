import { useState, useEffect, useCallback } from 'react';
import { Users, Search, Plus, X, Edit3, MapPin, Briefcase, Building } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { supabase } from '../lib/supabase';
import type { Contact } from '../lib/types';

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('contacts')
      .select('*')
      .eq('is_active', true)
      .order('display_name');

    if (filterLocation) {
      query = query.eq('location', filterLocation);
    }
    if (filterDepartment) {
      query = query.eq('department', filterDepartment);
    }
    if (search) {
      query = query.or(`display_name.ilike.%${search}%,short_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data } = await query;
    setContacts(data || []);
    setLoading(false);
  }, [search, filterLocation, filterDepartment]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const locations = [...new Set(contacts.map((c) => c.location).filter(Boolean))];
  const departments = [...new Set(contacts.map((c) => c.department).filter(Boolean))];

  const handleEdit = (contact: Contact) => {
    setEditContact(contact);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditContact(null);
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage HollyMart personnel directory</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Contact
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
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

        {locations.length > 0 && (
          <select
            value={filterLocation}
            onChange={(e) => setFilterLocation(e.target.value)}
            className="rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l!}>{l}</option>
            ))}
          </select>
        )}

        {departments.length > 0 && (
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d!}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description={
            search || filterLocation || filterDepartment
              ? 'Try adjusting your search or filters.'
              : 'Add contacts manually or they will be auto-created when the Baileys listener detects new participants.'
          }
          action={!search ? { label: 'Add Contact', onClick: handleAdd } : undefined}
        />
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Location</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Department</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="px-5 py-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${
                          contact.is_leadership ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {(contact.short_name || contact.display_name).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{contact.display_name}</p>
                          {contact.short_name && (
                            <p className="text-xs text-gray-500">{contact.short_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">{contact.role || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">{contact.location || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Building className="w-3 h-3 text-gray-400" />
                        <span className="text-gray-600">{contact.department || '-'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <span className="text-gray-500 font-mono text-xs">{contact.phone_number || '-'}</span>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <ContactModal
          contact={editContact}
          onClose={() => { setShowModal(false); setEditContact(null); }}
          onSaved={() => { setShowModal(false); setEditContact(null); fetchContacts(); }}
        />
      )}
    </div>
  );
}

function ContactModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    display_name: contact?.display_name || '',
    short_name: contact?.short_name || '',
    wa_jid: contact?.wa_jid || '',
    phone_number: contact?.phone_number || '',
    role: contact?.role || '',
    location: contact?.location || '',
    department: contact?.department || '',
    is_leadership: contact?.is_leadership || false,
    notes: contact?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.display_name.trim() || !form.wa_jid.trim()) return;

    setSaving(true);

    const payload = {
      display_name: form.display_name.trim(),
      short_name: form.short_name.trim() || null,
      wa_jid: form.wa_jid.trim(),
      phone_number: form.phone_number.trim() || null,
      role: form.role.trim() || null,
      location: form.location.trim() || null,
      department: form.department.trim() || null,
      is_leadership: form.is_leadership,
      notes: form.notes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (contact) {
      await supabase.from('contacts').update(payload).eq('id', contact.id);
    } else {
      await supabase.from('contacts').insert(payload);
    }

    setSaving(false);
    onSaved();
  };

  const update = (key: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg p-6 fade-in max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => update('display_name', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Budi Santoso"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Short Name</label>
              <input
                type="text"
                value={form.short_name}
                onChange={(e) => update('short_name', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Budi"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">WhatsApp JID *</label>
              <input
                type="text"
                value={form.wa_jid}
                onChange={(e) => update('wa_jid', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="628xxx@s.whatsapp.net"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone Number</label>
              <input
                type="text"
                value={form.phone_number}
                onChange={(e) => update('phone_number', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                placeholder="628123456789"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => update('role', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Store Manager"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Bima-1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={(e) => update('department', e.target.value)}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Operations"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_leadership"
              checked={form.is_leadership}
              onChange={(e) => update('is_leadership', e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="is_leadership" className="text-sm text-gray-700">
              Leadership level (manager and above)
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="Additional notes..."
            />
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
              disabled={!form.display_name.trim() || !form.wa_jid.trim() || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving...' : contact ? 'Save Changes' : 'Add Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
