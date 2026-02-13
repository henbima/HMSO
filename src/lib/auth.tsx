import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

// Only this email can use the app
const ALLOWED_EMAIL = 'hendra@hokkymart.com';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  unauthorized: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isAllowedUser(user: User | null): boolean {
  return user?.email?.toLowerCase() === ALLOWED_EMAIL;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    unauthorized: false,
  });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    // Safety timeout — if everything hangs, stop loading
    const safetyTimeout = setTimeout(() => {
      if (mounted.current) {
        setState(prev => prev.loading ? { ...prev, loading: false } : prev);
      }
    }, 8_000);

    // 1. Get existing session from localStorage
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted.current) return;

      if (s?.user) {
        if (!isAllowedUser(s.user)) {
          // Signed in but not allowed — sign them out
          supabase.auth.signOut().catch(() => {});
          setState({ user: null, session: null, loading: false, unauthorized: true });
        } else {
          setState({ user: s.user, session: s, loading: false, unauthorized: false });
        }
      } else {
        setState({ user: null, session: null, loading: false, unauthorized: false });
      }
    });

    // 2. Listen for auth changes — SYNCHRONOUS callback (no async!)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted.current) return;

      if (event === 'SIGNED_OUT') {
        setState({ user: null, session: null, loading: false, unauthorized: false });
      } else if (event === 'SIGNED_IN') {
        if (s?.user && !isAllowedUser(s.user)) {
          // Not allowed — kick them out (deferred to escape navigator.locks)
          setTimeout(() => {
            supabase.auth.signOut().catch(() => {});
          }, 0);
          setState({ user: null, session: null, loading: false, unauthorized: true });
        } else if (s?.user) {
          setState({ user: s.user, session: s, loading: false, unauthorized: false });
        }
      } else if (event === 'TOKEN_REFRESHED') {
        // Silent update — no loading, no disruption
        if (s?.user) {
          setState(prev => ({ ...prev, user: s.user, session: s }));
        }
      }
    });

    return () => {
      mounted.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Check email before even hitting Supabase
    if (email.toLowerCase() !== ALLOWED_EMAIL) {
      return { error: 'Access denied. This app is restricted.' };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[Auth] signOut failed:', err);
    } finally {
      if (mounted.current) {
        setState({ user: null, session: null, loading: false, unauthorized: false });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
