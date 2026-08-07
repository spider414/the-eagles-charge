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
  signUp: (phoneNumber: string, password: string, fullName?: string, referralCode?: string, securityQuestion?: string, securityAnswer?: string, ninData?: { nin: string; full_name: string } | null) => Promise<{ error: Error | null }>;
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
    // SECURITY: Only select fields needed for client-side display
    // Excludes sensitive fields: security_question, security_answer, paystack_customer_code
    // DVA details are served through the secure paystack-payment edge function
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id,
        user_id,
        email,
        full_name,
        phone_number,
        wallet_balance,
        referral_code,
        total_referral_earnings,
        dva_account_number,
        dva_account_name,
        dva_bank_name,
        created_at,
        updated_at,
        deletion_scheduled_at,
        deletion_reason
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data) {
      // Check if account was scheduled for deletion and cancel it
      if (data.deletion_scheduled_at) {
        console.log("Cancelling scheduled account deletion for user:", userId);
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            deletion_scheduled_at: null,
            deletion_reason: null,
          })
          .eq("user_id", userId);

        if (updateError) {
          console.error("Failed to cancel deletion:", updateError);
        } else {
          // Update local data to reflect cancellation
          data.deletion_scheduled_at = null;
          data.deletion_reason = null;
        }
      }
      // Cast to Profile type - paystack_customer_code is null as it's not fetched
      setProfile({
        ...data,
        paystack_customer_code: null,
        wallet_balance: data.wallet_balance ?? 0,
        total_referral_earnings: data.total_referral_earnings ?? 0,
      } as Profile);
    }

    // Self-heal: some signups never got a profile row (insert raced with session
    // creation). Create it now from auth metadata so Settings/Profile aren't empty.
    if (!error && !data) {
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authUser && authUser.id === userId) {
        const meta = (authUser.user_metadata ?? {}) as Record<string, string>;
        const derivedPhone =
          meta.phone_number ||
          (authUser.email?.match(/@(eagles\.local|phone\.harmicglobal\.com)$/)
            ? authUser.email.split("@")[0]
            : null);

        const { error: insertError } = await supabase.from("profiles").insert({
          user_id: userId,
          email: authUser.email ?? "",
          phone_number: derivedPhone,
          full_name: meta.full_name || null,
        });

        if (insertError) {
          console.error("Profile self-heal failed:", insertError);
        } else {
          await fetchProfile(userId);
        }
      }
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

  // Helper function to hash security answer using SHA-256
  const hashSecurityAnswer = async (answer: string): Promise<string> => {
    const normalized = answer.toLowerCase().trim();
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const signUp = async (phoneNumber: string, password: string, fullName?: string, referralCode?: string, securityQuestion?: string, securityAnswer?: string, ninData?: { nin: string; full_name: string } | null) => {
    // Create a fake email from phone number for Supabase auth (phone auth requires SMS setup)
    const fakeEmail = `${phoneNumber.replace(/\D/g, '')}@eagles.local`;
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email: fakeEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          phone_number: phoneNumber,
          full_name: fullName || null,
        },
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

      // Hash security answer before storing (security best practice)
      let hashedSecurityAnswer: string | null = null;
      if (securityAnswer) {
        hashedSecurityAnswer = await hashSecurityAnswer(securityAnswer);
      }

      // Create profile with phone number and hashed security answer
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: data.user.id,
          email: fakeEmail,
          phone_number: phoneNumber,
          full_name: fullName || null,
          referred_by: referredBy,
          security_question: securityQuestion || null,
          security_answer: hashedSecurityAnswer,
          phone_verified: true,
          nin_verified: !!ninData,
          nin_number: ninData?.nin || null,
          nin_full_name: ninData?.full_name || null,
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
