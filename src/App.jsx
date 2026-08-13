// App.jsx — Routes (AUTH TEMPORARILY BYPASSED — restore ProtectedRoute later)
import { AnimatePresence } from 'framer-motion';
import { Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Shell from './components/layout/Shell.jsx';

// Core pages
import Home                from './pages/Home.jsx';
import Navigation          from './pages/Navigation.jsx';
import StudentDashboard    from './pages/StudentDashboard.jsx';
import FacultyDashboard    from './pages/FacultyDashboard.jsx';
import Analytics           from './pages/Analytics.jsx';
import ClassroomManagement from './pages/ClassroomManagement.jsx';
import LabManagement       from './pages/LabManagement.jsx';

// Admin pages
import AdminDashboard     from './pages/admin/AdminDashboard.jsx';
import UserManagement     from './pages/admin/UserManagement.jsx';
import BuildingManagement from './pages/admin/BuildingManagement.jsx';
import FloorManagement    from './pages/admin/FloorManagement.jsx';
import TimetableManagement from './pages/admin/TimetableManagement.jsx';

import LibraryAnalytics    from './pages/monitoring/LibraryAnalytics.jsx';
import CrowdAnalytics      from './pages/monitoring/CrowdAnalytics.jsx';
import AttendanceAnalytics from './pages/monitoring/AttendanceAnalytics.jsx';

// AI pages
import AIPredictionEngine   from './pages/ai/AIPredictionEngine.jsx';
import AICampusAssistant    from './pages/ai/AICampusAssistant.jsx';
import RecommendationEngine from './pages/ai/RecommendationEngine.jsx';

// Navigation pages
import SmartNavigation  from './pages/navigation/SmartNavigation.jsx';
import IndoorNavigation from './pages/navigation/IndoorNavigation.jsx';

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/*" element={
          <Shell>
            <Routes>
              {/* Core */}
              <Route path="/"           element={<Home />} />
              <Route path="/navigation" element={<Navigation />} />
              <Route path="/student"    element={<StudentDashboard />} />
              <Route path="/faculty"    element={<FacultyDashboard />} />
              <Route path="/analytics"  element={<Analytics />} />
              <Route path="/classrooms" element={<ClassroomManagement />} />
              <Route path="/labs"       element={<LabManagement />} />

              {/* Admin */}
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/users"     element={<UserManagement />} />
              <Route path="/admin/buildings" element={<BuildingManagement />} />
              <Route path="/admin/floors"    element={<FloorManagement />} />
              <Route path="/admin/timetable" element={<TimetableManagement />} />

              {/* Monitoring */}
              <Route path="/monitoring/library"    element={<LibraryAnalytics />} />
              <Route path="/monitoring/crowd"      element={<CrowdAnalytics />} />
              <Route path="/monitoring/attendance" element={<AttendanceAnalytics />} />

              {/* AI Modules */}
              <Route path="/ai/predictions"    element={<AIPredictionEngine />} />
              <Route path="/ai/assistant"      element={<AICampusAssistant />} />
              <Route path="/ai/recommendations" element={<RecommendationEngine />} />

              {/* Navigation Modules */}
              <Route path="/navigation/smart"  element={<SmartNavigation />} />
              <Route path="/navigation/indoor" element={<IndoorNavigation />} />
            </Routes>
          </Shell>
        } />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
