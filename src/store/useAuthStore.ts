// Zustand Auth Store — State Management for Authentication
import { create } from 'zustand';
import { User } from '../types/index.ts';
import { attemptLogin, clearAuth, getStoredUser, registerUser } from '../utils/auth.js';

interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<User>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getStoredUser(),

  login: async (email: string, password: string) => {
    const user = attemptLogin(email, password);
    set({ user });
    return user;
  },

  register: async (data: any) => {
    const user = registerUser(data);
    set({ user });
    return user;
  },

  logout: () => {
    clearAuth();
    set({ user: null });
  },
}));
