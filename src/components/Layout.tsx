import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Compass,
  MessageSquare,
  Users,
  Menu,
  X,
  Activity,
  LogOut,
  FileText,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../lib/auth';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview' },
  { to: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { to: '/directions', icon: Compass, label: 'Directions' },
  { to: '/briefings', icon: FileText, label: 'Briefings' },
  { to: '/groups', icon: MessageSquare, label: 'Groups' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/import', icon: Upload, label: 'Import Chat' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-gray-900 text-sm">WA Intel</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-30 h-full w-60 bg-white border-r transform transition-transform duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm leading-tight">HollyMart</h1>
              <p className="text-[11px] text-gray-500 leading-tight">WA Intelligence</p>
            </div>
          </div>
        </div>

        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-gray-50/50 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-gray-500 truncate flex-1">{user?.email}</span>
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="lg:pl-60 pt-14 lg:pt-0">
        <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
