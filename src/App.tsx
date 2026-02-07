import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import OverviewPage from './pages/OverviewPage';
import TasksPage from './pages/TasksPage';
import DirectionsPage from './pages/DirectionsPage';
import GroupsPage from './pages/GroupsPage';
import ContactsPage from './pages/ContactsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<OverviewPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="directions" element={<DirectionsPage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="contacts" element={<ContactsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
