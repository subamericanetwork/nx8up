import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, userType: 'creator' | 'sponsor') => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('=== AUTH STATE CHANGE ===');
        console.log('Event:', event);
        console.log('Session:', session);
        console.log('User:', session?.user);
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (event === 'SIGNED_OUT') {
          console.log('User signed out - clearing all state');
          setUser(null);
          setSession(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('=== INITIAL SESSION CHECK ===');
      console.log('Initial session:', session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, userType: 'creator' | 'sponsor') => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          user_type: userType
        }
      }
    });

    // Update profile with user type after signup
    if (!error && user) {
      await supabase
        .from('profiles')
        .update({ user_type: userType, full_name: fullName })
        .eq('id', user.id);
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    return { error };
  };

  const signOut = async () => {
    console.log('=== SIGN OUT CLICKED ===');
    console.log('Current user:', user);
    console.log('Current session:', session);
    
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error details:', {
          message: error.message,
          status: error.status,
          name: error.name,
          stack: error.stack
        });
        
        // If session is already missing, treat as successful sign out
        if (error.name === 'AuthSessionMissingError' || error.message?.includes('Auth session missing')) {
          console.log('Session already missing - treating as successful sign out');
        } else {
          throw error;
        }
      }
      console.log('Sign out successful - clearing local state');
      
      // Force clear local state immediately
      setUser(null);
      setSession(null);
      
    } catch (error) {
      console.error('Sign out failed with error:', error);
      console.error('Error type:', typeof error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signUp,
      signIn,
      signOut
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