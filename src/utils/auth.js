// ── auth.js — Real backend auth utilities ─────────────────────────────────────
import { authApi } from './api.js';

const TOKEN_KEY = 'campussphere_token';
const USER_KEY  = 'campussphere_user';

/** Persist auth to localStorage */
function saveAuth(user, token) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/** Read stored user from localStorage */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Clear all auth data */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Attempt login against the real backend.
 * Returns user object on success, throws Error on failure.
 */
export async function attemptLogin(email, password) {
  const { access_token } = await authApi.login(email, password);
  localStorage.setItem(TOKEN_KEY, access_token);

  // Fetch full profile from /auth/me
  const user = await authApi.me();
  const userWithAvatar = {
    ...user,
    avatar: user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
  };
  saveAuth(userWithAvatar, access_token);
  return userWithAvatar;
}

/**
 * Register a new user against the real backend.
 * Returns user object on success.
 */
export async function registerUser(data) {
  const user = await authApi.register(data);
  // Auto-login after registration
  return attemptLogin(data.email, data.password);
}

/**
 * Validate stored token against /auth/me.
 * Returns user or null if token is invalid/expired.
 */
export async function validateStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const user = await authApi.me();
    const userWithAvatar = {
      ...user,
      avatar: user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase(),
    };
    localStorage.setItem(USER_KEY, JSON.stringify(userWithAvatar));
    return userWithAvatar;
  } catch {
    clearAuth();
    return null;
  }
}

/** Role display helpers */
export const roleColors = {
  admin:   { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444',  border: 'rgba(239,68,68,0.25)'   },
  faculty: { bg: 'rgba(245,158,11,0.12)',  text: '#F59E0B',  border: 'rgba(245,158,11,0.25)'  },
  student: { bg: 'rgba(0,229,255,0.12)',   text: '#00E5FF',  border: 'rgba(0,229,255,0.25)'   },
  staff:   { bg: 'rgba(123,97,255,0.12)',  text: '#7B61FF',  border: 'rgba(123,97,255,0.25)'  },
};
