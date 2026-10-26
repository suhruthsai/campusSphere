// App.jsx — Routes
import { lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Shell from './components/layout/Shell.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import PageErrorBoundary from './components/layout/PageErrorBoundary.jsx';

// Auth pages
import Login          from './pages/auth/Login.jsx';
import Register       from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

// Pages are code-split: each loads on first visit, so the login screen and
// lighter pages don't wait for the large 3D bundle.
// Core pages
const Home = lazy(() => import('./pages/Home.jsx'));
const Navigation = lazy(() => import('./pages/Navigation.jsx'));
const StudentDashboard = lazy(() => import('./pages/StudentDashboard.jsx'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx'));
const Analytics = lazy(() => import('./pages/Analytics.jsx'));
const ClassroomManagement = lazy(() => import('./pages/ClassroomManagement.jsx'));
const LabManagement = lazy(() => import('./pages/LabManagement.jsx'));

// Admin pages
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const UserManagement = lazy(() => import('./pages/admin/UserManagement.jsx'));
const BuildingManagement = lazy(() => import('./pages/admin/BuildingManagement.jsx'));
const FloorManagement = lazy(() => import('./pages/admin/FloorManagement.jsx'));
const TimetableManagement = lazy(() => import('./pages/admin/TimetableManagement.jsx'));
const SubstitutionManagement = lazy(() => import('./pages/admin/SubstitutionManagement.jsx'));

const LibraryAnalytics = lazy(() => import('./pages/monitoring/LibraryAnalytics.jsx'));
const CrowdAnalytics = lazy(() => import('./pages/monitoring/CrowdAnalytics.jsx'));
const AttendanceAnalytics = lazy(() => import('./pages/monitoring/AttendanceAnalytics.jsx'));

// AI pages
const AIPredictionEngine = lazy(() => import('./pages/ai/AIPredictionEngine.jsx'));
const AICampusAssistant = lazy(() => import('./pages/ai/AICampusAssistant.jsx'));
const RecommendationEngine = lazy(() => import('./pages/ai/RecommendationEngine.jsx'));
const ClassroomUtilization = lazy(() => import('./pages/ai/ClassroomUtilization.jsx'));

// Navigation pages
const SmartNavigation = lazy(() => import('./pages/navigation/SmartNavigation.jsx'));
// Student Services
const MyRequests = lazy(() => import('./pages/services/MyRequests.jsx'));
const ApprovalsInbox = lazy(() => import('./pages/services/ApprovalsInbox.jsx'));
const ServicesSetup = lazy(() => import('./pages/services/ServicesSetup.jsx'));
const VerifyDocument = lazy(() => import('./pages/services/VerifyDocument.jsx'));
// Joining after TGEAPCET counselling, college fees, originals register
const JoiningJourney = lazy(() => import('./pages/joining/JoiningJourney.jsx'));
const AdmissionsDesk = lazy(() => import('./pages/joining/AdmissionsDesk.jsx'));
const OriginalsRegister = lazy(() => import('./pages/joining/OriginalsRegister.jsx'));
const FeeSettings = lazy(() => import('./pages/joining/FeeSettings.jsx'));
const MyAccount = lazy(() => import('./pages/auth/MyAccount.jsx'));
// Leaving the college (V3)
const LeavingJourney = lazy(() => import('./pages/leaving/LeavingJourney.jsx'));
const ClearanceDesk = lazy(() => import('./pages/leaving/ClearanceDesk.jsx'));
const ExamCellDesk = lazy(() => import('./pages/leaving/ExamCellDesk.jsx'));
const IndoorNavigation = lazy(() => import('./pages/navigation/IndoorNavigation.jsx'));

const ADMIN = ['admin'];

// Logged-in users don't need to see the login/register pages
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-32 text-center">
      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-cyan-300">404</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Page not found</h1>
      <p className="mt-2 text-sm text-slate-400">This address doesn't exist in CampusSphere.</p>
      <a href="/" className="mt-5 inline-block rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-900 hover:bg-cyan-300">Back to the campus</a>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#00E5FF]" />
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register"        element={<GuestOnly><Register /></GuestOnly>} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* Public: anyone holding a certificate's QR code can check it, no account needed */}
        <Route path="/verify"       element={<Suspense fallback={<PageFallback />}><VerifyDocument /></Suspense>} />
        <Route path="/verify/:code" element={<Suspense fallback={<PageFallback />}><VerifyDocument /></Suspense>} />

        <Route path="/*" element={
          <ProtectedRoute>
          <Shell>
            {/* Keyed here (not on the outer Routes) so navigating only swaps the page —
                previously the whole Shell was torn down and rebuilt on every click. */}
            <PageErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageFallback />}>
            <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
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
              <Route path="/ai/utilization"    element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><ClassroomUtilization /></ProtectedRoute>} />

              {/* Navigation Modules */}
              <Route path="/navigation/smart"  element={<SmartNavigation />} />
              <Route path="/navigation/indoor" element={<IndoorNavigation />} />

              {/* Student Services */}
              <Route path="/services"           element={<ProtectedRoute allowedRoles={['student']}><MyRequests /></ProtectedRoute>} />
              <Route path="/services/approvals" element={<ProtectedRoute allowedRoles={['faculty', 'staff', 'admin']}><ApprovalsInbox /></ProtectedRoute>} />
              <Route path="/services/setup"     element={<ProtectedRoute allowedRoles={ADMIN}><ServicesSetup /></ProtectedRoute>} />
              <Route path="/joining"            element={<ProtectedRoute allowedRoles={['student']}><JoiningJourney /></ProtectedRoute>} />
              <Route path="/joining/desk"       element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdmissionsDesk /></ProtectedRoute>} />
              <Route path="/joining/originals"  element={<ProtectedRoute allowedRoles={['admin', 'staff']}><OriginalsRegister /></ProtectedRoute>} />
              <Route path="/joining/fees"       element={<ProtectedRoute allowedRoles={ADMIN}><FeeSettings /></ProtectedRoute>} />
              <Route path="/leaving"            element={<ProtectedRoute allowedRoles={['student']}><LeavingJourney /></ProtectedRoute>} />
              <Route path="/leaving/desk"       element={<ProtectedRoute allowedRoles={['faculty', 'staff', 'admin']}><ClearanceDesk /></ProtectedRoute>} />
              <Route path="/leaving/exam-cell"  element={<ProtectedRoute allowedRoles={['faculty', 'staff', 'admin']}><ExamCellDesk /></ProtectedRoute>} />
              <Route path="/account"            element={<MyAccount />} />
              {/* Anything else inside the app */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AnimatePresence>
            </Suspense>
            </PageErrorBoundary>
          </Shell>
          </ProtectedRoute>
        } />
      </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
