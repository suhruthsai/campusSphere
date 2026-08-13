// ── AuthContext — AUTH TEMPORARILY BYPASSED ────────────────────────────────
// TODO: Remove mock and restore real auth when adding the auth module back.
import { createContext, useContext, useMemo } from 'react';

const AuthContext = createContext(null);

const MOCK_USER = {
  id: 'guest',
  name: 'CampusSphere User',
  email: 'user@campussphere.local',
  role: 'admin',
};

export function AuthProvider({ children }) {
  const value = useMemo(() => ({
    user:      MOCK_USER,
    loading:   false,
    login:     async () => MOCK_USER,
    logout:    () => {},
    register:  async () => MOCK_USER,
    isAdmin:   true,
    isFaculty: false,
    isStudent: false,
    isStaff:   false,
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
