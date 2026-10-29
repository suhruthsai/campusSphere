// ── AuthContext — real backend auth (JWT via /api/v1/auth) ────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { attemptLogin, clearAuth, getStoredUser, validateStoredToken } from '../utils/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Optimistically show the cached user, then confirm the token with the backend.
  const [user,    setUser]    = useState(getStoredUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    validateStoredToken().then((u) => {
      if (!cancelled) { setUser(u); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email, password) => {
    const u = await attemptLogin(email, password);
    setUser(u);
    return u;
  }, []);

  // After a change on the server (e.g. a new password), reload who I am
  const refreshUser = useCallback(async () => {
    const u = await validateStoredToken();
    if (u) setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAdmin:   user?.role === 'admin',
    isFaculty: user?.role === 'faculty',
    isStudent: user?.role === 'student',
    isStaff:   user?.role === 'staff',
  }), [user, loading, login, logout, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
