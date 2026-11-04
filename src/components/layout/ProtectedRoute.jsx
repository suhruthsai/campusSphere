// ── ProtectedRoute — redirects unauthenticated/unauthorized users ─────────────
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { hasStoredToken } from '../../utils/auth.js';

/**
 * @param {string[]} [allowedRoles] — if provided, user must have one of these roles
 * @param {string[]} [publicPaths]  — pages a guest (not signed in) may open without being sent to /login
 */
export default function ProtectedRoute({ children, allowedRoles, publicPaths }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const guestMayStay = publicPaths?.includes(location.pathname);

  // A guest with no stored token has nothing to verify: show the page at once
  if (!user && guestMayStay && !hasStoredToken()) return children;

  // Wait for the stored token to be verified before deciding
  if (loading && !user) return null;

  if (!user) {
    if (guestMayStay) return children;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // A temporary password (new account, admin reset): choose your own before anything else
  if (user.must_change_password && location.pathname !== '/account') {
    return <Navigate to="/account" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
