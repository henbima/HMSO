import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import TasksPage from './pages/TasksPage';
import DirectionsPage from './pages/DirectionsPage';
import BriefingsPage from './pages/BriefingsPage';
import GroupsPage from './pages/GroupsPage';
import ContactsPage from './pages/ContactsPage';
import ImportPage from './pages/ImportPage';
import { Loader2 } from 'lucide-react';

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="tasks" element={<TasksPage />} />
        <Route path="directions" element={<DirectionsPage />} />
        <Route path="briefings" element={<BriefingsPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="import" element={<ImportPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
