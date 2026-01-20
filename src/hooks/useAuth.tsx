import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  sendVerificationEmail: (email: string, purpose: 'signup' | 'password_reset') => Promise<{ success: boolean; error?: string; expiresAt?: string }>;
  verifyEmailCode: (email: string, code: string, purpose: 'signup' | 'password_reset') => Promise<{ verified: boolean; verificationId?: string; error?: string }>;
  resetPassword: (email: string, newPassword: string, verificationId: string) => Promise<{ success: boolean; error?: string }>;
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
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const sendVerificationEmail = async (email: string, purpose: 'signup' | 'password_reset') => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/send-verification-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, purpose }),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error };
      return { success: true, expiresAt: data.expiresAt };
    } catch (error) {
      return { success: false, error: '서버 오류가 발생했습니다.' };
    }
  };

  const verifyEmailCode = async (email: string, code: string, purpose: 'signup' | 'password_reset') => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/verify-email-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, purpose }),
      });
      const data = await response.json();
      if (!response.ok) return { verified: false, error: data.error };
      return { verified: true, verificationId: data.verificationId };
    } catch (error) {
      return { verified: false, error: '서버 오류가 발생했습니다.' };
    }
  };

  const resetPassword = async (email: string, newPassword: string, verificationId: string) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword, verificationId }),
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.error };
      return { success: true };
    } catch (error) {
      return { success: false, error: '서버 오류가 발생했습니다.' };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, session, loading, 
      signUp, signIn, signOut,
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
