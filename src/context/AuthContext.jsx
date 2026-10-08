// ── AuthContext — real backend auth (JWT via /api/v1/auth) ────────────────────
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { attemptLogin, clearAuth, getStoredUser, registerUser, validateStoredToken } from '../utils/auth.js';

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

  // Returns the created user. Accounts that need admin approval are not logged in.
  const register = useCallback(async (data) => {
    const u = await registerUser(data);
    if (u.status === 'active') setUser(u);
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
    register,
    isAdmin:   user?.role === 'admin',
    isFaculty: user?.role === 'faculty',
    isStudent: user?.role === 'student',
    isStaff:   user?.role === 'staff',
  }), [user, loading, login, logout, register]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
