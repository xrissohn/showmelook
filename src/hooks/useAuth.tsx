import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: (Error & { code?: string }) | null }>;
  completeSignup: (input: { email: string; password: string; fullName: string; verificationId: string; referralCode?: string; language: 'ko' | 'en' }) => Promise<AuthCallResult & { referral?: { applied: boolean; reward_type?: string } | null }>;
  signOut: () => Promise<void>;
  sendVerificationEmail: (email: string, purpose: 'signup' | 'password_reset') => Promise<AuthCallResult & { expiresAt?: string }>;
  verifyEmailCode: (email: string, code: string, purpose: 'signup' | 'password_reset') => Promise<{ verified: boolean; verificationId?: string; error?: string; errorCode?: string; remainingAttempts?: number }>;
  resetPassword: (email: string, newPassword: string, verificationId: string) => Promise<AuthCallResult>;
}

export interface AuthCallResult {
  success: boolean;
  error?: string;
  errorCode?: string;
  reasons?: string[];
}

async function postFunction(name: string, body: unknown): Promise<{ ok: boolean; data: any; networkError?: boolean }> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, data };
  } catch {
    return { ok: false, data: {}, networkError: true };
  }
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as (Error & { code?: string }) | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const sendVerificationEmail = async (email: string, purpose: 'signup' | 'password_reset') => {
    const r = await postFunction('send-verification-email', { email, purpose });
    if (r.networkError) return { success: false, errorCode: 'network_error' };
    if (!r.ok) return { success: false, error: r.data.error, errorCode: r.data.error_code };
    return { success: true, expiresAt: r.data.expiresAt };
  };

  const verifyEmailCode = async (email: string, code: string, purpose: 'signup' | 'password_reset') => {
    const r = await postFunction('verify-email-code', { email, code, purpose });
    if (r.networkError) return { verified: false, errorCode: 'network_error' };
    if (!r.ok) return { verified: false, error: r.data.error, errorCode: r.data.error_code, remainingAttempts: r.data.remainingAttempts };
    return { verified: true, verificationId: r.data.verificationId };
  };

  const resetPassword = async (email: string, newPassword: string, verificationId: string) => {
    const r = await postFunction('reset-password', { email, newPassword, verificationId });
    if (r.networkError) return { success: false, errorCode: 'network_error' };
    if (!r.ok) return { success: false, error: r.data.error, errorCode: r.data.error_code };
    return { success: true };
  };

  const completeSignup: AuthContextType['completeSignup'] = async (input) => {
    const r = await postFunction('complete-signup', input);
    if (r.networkError) return { success: false, errorCode: 'network_error' };
    if (!r.ok || !r.data.success) {
      return { success: false, error: r.data.message ?? r.data.error, errorCode: r.data.error_code ?? 'server_error', reasons: r.data.reasons };
    }
    return { success: true, referral: r.data.referral ?? null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, session, loading, 
      signUp, signIn, signOut, completeSignup,
      sendVerificationEmail, verifyEmailCode, resetPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
