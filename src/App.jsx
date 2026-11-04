// App.jsx — Routes
import { lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import Shell from './components/layout/Shell.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import { HOME_FOR } from './components/layout/navConfig.js';
import PageErrorBoundary from './components/layout/PageErrorBoundary.jsx';

// Auth pages
import Login          from './pages/auth/Login.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

// Pages are code-split: each loads on first visit, so the login screen and
// lighter pages don't wait for the large 3D bundle.
// Core pages
const loadHome = () => import('./pages/Home.jsx');
const Home = lazy(loadHome);
// The 3D campus is the front door: start downloading it now, in parallel with the sign-in check, not after it
if (typeof window !== 'undefined' && window.location.pathname === '/') loadHome();
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
const KnowledgeBase = lazy(() => import('./pages/admin/KnowledgeBase.jsx'));

// Room utilisation model (the sample-data Monitoring and AI pages are no longer routed; their links redirect home)
const ClassroomUtilization = lazy(() => import('./pages/ai/ClassroomUtilization.jsx'));

// Navigation pages
const SmartNavigation = lazy(() => import('./pages/navigation/SmartNavigation.jsx'));
// Student Services
const MyRequests = lazy(() => import('./pages/services/MyRequests.jsx'));
const ApprovalsInbox = lazy(() => import('./pages/services/ApprovalsInbox.jsx'));
const ServicesSetup = lazy(() => import('./pages/services/ServicesSetup.jsx'));
const RollList = lazy(() => import('./pages/services/RollList.jsx'));
const VerifyDocument = lazy(() => import('./pages/services/VerifyDocument.jsx'));
// Joining after TGEAPCET counselling, college fees, originals register
const JoiningJourney = lazy(() => import('./pages/joining/JoiningJourney.jsx'));
const AdmissionsDesk = lazy(() => import('./pages/joining/AdmissionsDesk.jsx'));
const OriginalsRegister = lazy(() => import('./pages/joining/OriginalsRegister.jsx'));
const FeeSettings = lazy(() => import('./pages/joining/FeeSettings.jsx'));
const JoiningDocRules = lazy(() => import('./pages/joining/JoiningDocRules.jsx'));
const MyAccount = lazy(() => import('./pages/auth/MyAccount.jsx'));
// Leaving the college (V3)
const LeavingJourney = lazy(() => import('./pages/leaving/LeavingJourney.jsx'));
const ClearanceDesk = lazy(() => import('./pages/leaving/ClearanceDesk.jsx'));
const ExamCellDesk = lazy(() => import('./pages/leaving/ExamCellDesk.jsx'));
const IndoorNavigation = lazy(() => import('./pages/navigation/IndoorNavigation.jsx'));
const Notices = lazy(() => import('./pages/Notices.jsx'));
const Attendance = lazy(() => import('./pages/Attendance.jsx'));
// Accreditation Autopilot
const Accreditation = lazy(() => import('./pages/admin/Accreditation.jsx'));
const DepartmentReport = lazy(() => import('./pages/admin/DepartmentReport.jsx'));
const AccreditationWorkspace = lazy(() => import('./pages/admin/AccreditationWorkspace.jsx'));
const Outcomes = lazy(() => import('./pages/admin/Outcomes.jsx'));
const Results = lazy(() => import('./pages/admin/Results.jsx'));
const FacultyResearch = lazy(() => import('./pages/research/FacultyResearch.jsx'));
const MyResearch = lazy(() => import('./pages/research/MyResearch.jsx'));
const InstitutionRecords = lazy(() => import('./pages/admin/InstitutionRecords.jsx'));
const Readiness = lazy(() => import('./pages/admin/Readiness.jsx'));
const Feedback = lazy(() => import('./pages/feedback/Feedback.jsx'));
const PublicFeedback = lazy(() => import('./pages/feedback/PublicFeedback.jsx'));
const Placements = lazy(() => import('./pages/placements/Placements.jsx'));
const PlacementCell = lazy(() => import('./pages/placements/PlacementCell.jsx'));
const DeskWall = lazy(() => import('./pages/admin/DeskWall.jsx'));
// CampusLocker: everyone signed in has one; the Admin Office adds official documents; share links open without login
const Locker = lazy(() => import('./pages/locker/Locker.jsx'));
const LockerOffice = lazy(() => import('./pages/locker/LockerOffice.jsx'));
const SharedDocument = lazy(() => import('./pages/locker/SharedDocument.jsx'));
const ADMIN = ['admin'];

// Old links to pages that left the menus (sample data, the old assistant): go to the person's own home page
function RoleHome() {
  const { user } = useAuth();
  return <Navigate to={HOME_FOR[user?.role] || '/'} replace />;
}

// Logged-in users don't need to see the login page
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

function PageFallback({ label }) {
  return (
    <div className="grid min-h-[60vh] place-items-center">
      <div className="flex flex-col items-center gap-3">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-[#00E5FF]" />
        {label && <span className="text-xs tracking-wide text-slate-400">{label}</span>}
      </div>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
      <Routes>
        {/* Public */}
        <Route path="/login"           element={<GuestOnly><Login /></GuestOnly>} />
        {/* No public sign-up: the college creates accounts. Old links land on the login page. */}
        <Route path="/register"        element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        {/* Public: anyone holding a certificate's QR code can check it, no account needed */}
        <Route path="/verify"       element={<Suspense fallback={<PageFallback />}><VerifyDocument /></Suspense>} />
        <Route path="/verify/:code" element={<Suspense fallback={<PageFallback />}><VerifyDocument /></Suspense>} />
        {/* Public: alumni, employers and parents answer feedback forms by the IQAC's link */}
        <Route path="/f/:code"      element={<Suspense fallback={<PageFallback />}><PublicFeedback /></Suspense>} />
        {/* Public: whoever holds a live CampusLocker share link can view that one document */}
        <Route path="/shared/:token" element={<Suspense fallback={<PageFallback />}><SharedDocument /></Suspense>} />
        {/* The visitor view moved to the front door ("/"): old /visit links and QR codes land there */}
        <Route path="/visit"        element={<Navigate to="/" replace />} />

        {/* "/" is open to everyone: guests see the 3D campus and Mitra (public information only) and a
            Sign in button; every other page needs an account. Same tree for both, so the map stays
            mounted when someone signs in over it. */}
        <Route path="/*" element={
          <ProtectedRoute publicPaths={['/']}>
          <Shell>
            {/* Keyed here (not on the outer Routes) so navigating only swaps the page —
                previously the whole Shell was torn down and rebuilt on every click. */}
            <PageErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageFallback label={location.pathname === '/' ? 'Loading the 3D campus…' : undefined} />}>
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
              {/* Substitutions: admins, and HODs for their department (the page and the API check the HOD role) */}
              <Route path="/admin/substitutions" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><SubstitutionManagement /></ProtectedRoute>} />
              <Route path="/admin/knowledge"     element={<ProtectedRoute allowedRoles={ADMIN}><KnowledgeBase /></ProtectedRoute>} />
              {/* Accreditation: admins and the Principal (a faculty account; the API checks the assignment) */}
              {/* Department report: HOD (own department), Principal, management, admins (the API checks) */}
              {/* Placements: students apply; the Placement Cell, HODs and management see drives and the report (the API checks) */}
              <Route path="/placements"          element={<ProtectedRoute allowedRoles={['student']}><Placements /></ProtectedRoute>} />
              <Route path="/placements/cell"     element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><PlacementCell /></ProtectedRoute>} />
              <Route path="/reports/department"  element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><DepartmentReport /></ProtectedRoute>} />
              <Route path="/accreditation"       element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><Accreditation /></ProtectedRoute>} />
              <Route path="/accreditation/faculty" element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><FacultyResearch /></ProtectedRoute>} />
              <Route path="/accreditation/readiness" element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><Readiness /></ProtectedRoute>} />
              <Route path="/accreditation/institution" element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><InstitutionRecords /></ProtectedRoute>} />
              <Route path="/my-research"         element={<ProtectedRoute allowedRoles={['faculty']}><MyResearch /></ProtectedRoute>} />
              <Route path="/accreditation/results" element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><Results /></ProtectedRoute>} />
              <Route path="/feedback"            element={<Feedback />} />
              <Route path="/accreditation/outcomes" element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><Outcomes /></ProtectedRoute>} />
              <Route path="/accreditation/workspace" element={<ProtectedRoute allowedRoles={['admin', 'faculty', 'staff']}><AccreditationWorkspace /></ProtectedRoute>} />
              <Route path="/accreditation/desks" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><DeskWall /></ProtectedRoute>} />

              {/* Sample-data pages and the old assistant page: old links go home (Mitra is the assistant now) */}
              <Route path="/monitoring/*"      element={<RoleHome />} />
              <Route path="/ai/predictions"    element={<RoleHome />} />
              <Route path="/ai/assistant"      element={<RoleHome />} />
              <Route path="/ai/recommendations" element={<RoleHome />} />
              <Route path="/ai/utilization"    element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><ClassroomUtilization /></ProtectedRoute>} />
              {/* Short names for the merged pages */}
              <Route path="/notices" element={<Notices />} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={['student', 'faculty', 'admin']}><Attendance /></ProtectedRoute>} />
              <Route path="/find"  element={<Navigate to="/navigation" replace />} />
              <Route path="/rooms" element={<Navigate to="/classrooms" replace />} />

              {/* Navigation Modules */}
              <Route path="/navigation/smart"  element={<SmartNavigation />} />
              <Route path="/navigation/indoor" element={<IndoorNavigation />} />

              {/* Student Services */}
              <Route path="/services"           element={<ProtectedRoute allowedRoles={['student']}><MyRequests /></ProtectedRoute>} />
              <Route path="/services/approvals" element={<ProtectedRoute allowedRoles={['faculty', 'staff', 'admin']}><ApprovalsInbox /></ProtectedRoute>} />
              <Route path="/services/setup"     element={<ProtectedRoute allowedRoles={ADMIN}><ServicesSetup /></ProtectedRoute>} />
              <Route path="/services/roll-list" element={<ProtectedRoute allowedRoles={['admin', 'staff']}><RollList /></ProtectedRoute>} />
              <Route path="/joining"            element={<ProtectedRoute allowedRoles={['student']}><JoiningJourney /></ProtectedRoute>} />
              <Route path="/joining/desk"       element={<ProtectedRoute allowedRoles={['admin', 'staff']}><AdmissionsDesk /></ProtectedRoute>} />
              <Route path="/joining/originals"  element={<ProtectedRoute allowedRoles={['admin', 'staff']}><OriginalsRegister /></ProtectedRoute>} />
              <Route path="/joining/fees"       element={<ProtectedRoute allowedRoles={ADMIN}><FeeSettings /></ProtectedRoute>} />
              <Route path="/joining/documents"  element={<ProtectedRoute allowedRoles={ADMIN}><JoiningDocRules /></ProtectedRoute>} />
              <Route path="/leaving"            element={<ProtectedRoute allowedRoles={['student']}><LeavingJourney /></ProtectedRoute>} />
              <Route path="/leaving/desk"       element={<ProtectedRoute allowedRoles={['faculty', 'staff', 'admin']}><ClearanceDesk /></ProtectedRoute>} />
              <Route path="/leaving/exam-cell"  element={<ProtectedRoute allowedRoles={['faculty', 'staff', 'admin']}><ExamCellDesk /></ProtectedRoute>} />
              <Route path="/locker"             element={<Locker />} />
              <Route path="/locker/office"      element={<ProtectedRoute allowedRoles={['admin', 'staff']}><LockerOffice /></ProtectedRoute>} />
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
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}
