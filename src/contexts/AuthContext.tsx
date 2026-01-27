import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  phone_number: string | null;
  wallet_balance: number;
  referral_code: string | null;
  total_referral_earnings: number;
  paystack_customer_code: string | null;
  dva_account_number: string | null;
  dva_account_name: string | null;
  dva_bank_name: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signUp: (phoneNumber: string, password: string, fullName?: string, referralCode?: string, securityQuestion?: string, securityAnswer?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile fetch with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (phoneNumber: string, password: string, fullName?: string, referralCode?: string, securityQuestion?: string, securityAnswer?: string) => {
    // Create a fake email from phone number for Supabase auth (phone auth requires SMS setup)
    const fakeEmail = `${phoneNumber.replace(/\D/g, '')}@eagles.local`;
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (!error && data.user) {
      // Find referrer if referral code provided
      let referredBy: string | null = null;
      if (referralCode) {
        const { data: referrerProfile } = await supabase
          .from("profiles")
          .select("id")
          .eq("referral_code", referralCode.toUpperCase())
          .maybeSingle();
        
        if (referrerProfile) {
          referredBy = referrerProfile.id;
        }
      }

      // Create profile with phone number and security question
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: data.user.id,
          email: fakeEmail,
          phone_number: phoneNumber,
          full_name: fullName || null,
          referred_by: referredBy,
          security_question: securityQuestion || null,
          security_answer: securityAnswer || null,
          phone_verified: true,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
      }
    }

    return { error: error as Error | null };
  };

  const signIn = async (phoneNumber: string, password: string) => {
    // Use the fake email format to match signup
    const fakeEmail = `${phoneNumber.replace(/\D/g, '')}@eagles.local`;
    
    const { error } = await supabase.auth.signInWithPassword({
      email: fakeEmail,
      password,
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
