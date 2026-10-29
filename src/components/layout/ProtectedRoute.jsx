// ── ProtectedRoute — redirects unauthenticated/unauthorized users ─────────────
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * @param {string[]} [allowedRoles] — if provided, user must have one of these roles
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Wait for the stored token to be verified before deciding
  if (loading && !user) return null;

  if (!user) {
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
