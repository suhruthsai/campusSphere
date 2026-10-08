// App.jsx — Routes
import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Shell from './components/layout/Shell.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';

// Auth pages
import Login          from './pages/auth/Login.jsx';
import Register       from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

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
import SubstitutionManagement from './pages/admin/SubstitutionManagement.jsx';

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

const ADMIN = ['admin'];

// Logged-in users don't need to see the login/register pages
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function AppRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/login"           element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register"        element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        <Route path="/*" element={
          <ProtectedRoute>
          <Shell>
            <Routes>
              {/* Core */}
              <Route path="/"           element={<Home />} />
              <Route path="/navigation" element={<Navigation />} />
              <Route path="/student"    element={<ProtectedRoute allowedRoles={['student', 'admin']}><StudentDashboard /></ProtectedRoute>} />
              <Route path="/faculty"    element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><FacultyDashboard /></ProtectedRoute>} />
              <Route path="/analytics"  element={<ProtectedRoute allowedRoles={['faculty', 'admin']}><Analytics /></ProtectedRoute>} />
              <Route path="/classrooms" element={<ClassroomManagement />} />
              <Route path="/labs"       element={<LabManagement />} />

              {/* Admin */}
              <Route path="/admin/dashboard"     element={<ProtectedRoute allowedRoles={ADMIN}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/users"         element={<ProtectedRoute allowedRoles={ADMIN}><UserManagement /></ProtectedRoute>} />
              <Route path="/admin/buildings"     element={<ProtectedRoute allowedRoles={ADMIN}><BuildingManagement /></ProtectedRoute>} />
              <Route path="/admin/floors"        element={<ProtectedRoute allowedRoles={ADMIN}><FloorManagement /></ProtectedRoute>} />
              <Route path="/admin/timetable"     element={<ProtectedRoute allowedRoles={ADMIN}><TimetableManagement /></ProtectedRoute>} />
              <Route path="/admin/substitutions" element={<ProtectedRoute allowedRoles={ADMIN}><SubstitutionManagement /></ProtectedRoute>} />

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
          </ProtectedRoute>
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
