import type {
  AuthResponse,
  AuthTokenResponsePassword,
  Session,
  User,
} from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase, supabaseConfigurationError } from '../../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  configurationError: string | null;
  signIn: (email: string, password: string) => Promise<AuthTokenResponsePassword>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

function getAuthCallbackUrl() {
  if (typeof window === 'undefined') {
    return undefined;
  }

  return `${window.location.origin}/auth/callback`;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;

      if (error) {
        console.error('Não foi possível restaurar a sessão.', error);
      }

      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;

      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      configurationError: supabaseConfigurationError,
      signIn: async (email, password) => {
        if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
        return supabase.auth.signInWithPassword({ email, password });
      },
      signUp: async (email, password) => {
        if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase não configurado.');
        return supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
          },
        });
      },
      signOut: async () => {
        if (!supabase) return;

        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// O provider e o hook ficam juntos para manter a API de autenticação em um único módulo.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }

  return context;
}
