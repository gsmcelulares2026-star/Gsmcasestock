import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { Session } from '@supabase/supabase-js';

import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { UserProfile } from './types';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  isConfigured: boolean;
  isDemo: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(session: Session | null) {
  if (!supabase || !session?.user) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', session.user.id)
    .single();

  if (error) {
    throw error;
  }

  return {
    id: data.id,
    fullName: data.full_name ?? undefined,
    role: data.role,
    isActive: data.is_active,
  } satisfies UserProfile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);

  async function refreshProfileForSession(nextSession: Session | null) {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }

    if (!nextSession) {
      setProfile(null);
      return;
    }

    try {
      const nextProfile = await fetchProfile(nextSession);
      setProfile(nextProfile);
    } catch {
      setProfile(null);
    }
  }

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) {
        return;
      }

      setSession(data.session);
      await refreshProfileForSession(data.session);
      setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void refreshProfileForSession(nextSession);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      isConfigured: isSupabaseConfigured,
      isDemo: !isSupabaseConfigured || !session,
      isLoading,
      signIn: async (email, password) => {
        if (!supabase) {
          return;
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          throw error;
        }
      },
      signUp: async (email, password, fullName) => {
        if (!supabase) {
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) {
          throw error;
        }
      },
      signOut: async () => {
        if (!supabase) {
          return;
        }

        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      },
      refreshProfile: async () => {
        await refreshProfileForSession(session);
      },
    }),
    [isLoading, profile, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
