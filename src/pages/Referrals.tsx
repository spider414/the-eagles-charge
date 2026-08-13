import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSignupBonus } from "@/hooks/useSignupBonus";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Users, Copy, Share2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import BrandLogo from "@/components/BrandLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface ReferralStats {
  totalReferrals: number;
  totalEarnings: number;
}

const Referrals = () => {
  const navigate = useNavigate();
  const { formatCurrency } = useLanguage();
  const signupBonus = useSignupBonus();
  const bonusLabel = signupBonus.enabled ? formatCurrency(signupBonus.amount) : null;
  const { user, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState<ReferralStats>({ totalReferrals: 0, totalEarnings: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchReferralStats = async () => {
      if (!profile) return;

      setIsLoading(true);
      
      // Get total referrals
      const { count } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("referred_by", profile.id);

      setStats({
        totalReferrals: count || 0,
        totalEarnings: profile.total_referral_earnings || 0,
      });
      setIsLoading(false);
    };

    fetchReferralStats();
  }, [profile]);

  const copyReferralCode = () => {
    if (profile?.referral_code) {
      navigator.clipboard.writeText(profile.referral_code);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
    }
  };

  const shareReferralLink = () => {
    const referralLink = `${window.location.origin}/auth?ref=${profile?.referral_code}`;
    
    if (navigator.share) {
      navigator.share({
        title: "Join HARMIC RECHARGE",
        text: `Join HARMIC RECHARGE using my referral code ${profile?.referral_code} and get bonus credits!`,
        url: referralLink,
      });
    } else {
      navigator.clipboard.writeText(referralLink);
      toast({
        title: "Link Copied!",
        description: "Referral link copied to clipboard",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BrandLogo className="h-10 w-10" rounded="rounded-xl" />
              <span className="text-xl font-bold text-foreground">
                Referral <span className="text-gradient-gold">Program</span>
              </span>
            </div>
          </div>
          <LanguageSwitcher className="ml-auto" />
        </div>
      </header>

      <main className="container py-8 max-w-2xl">
        {/* Hero Card */}
        <Card className="mb-8 gradient-hero text-primary-foreground overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-full -translate-y-1/2 translate-x-1/2" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center gap-3 mb-4">
              <Gift className="h-8 w-8" />
              <div>
              <h2 className="text-xl font-bold">Earn ₦1,000 Per Referral!</h2>
                <p className="text-primary-foreground/80 text-sm">
                  Invite friends and earn bonus credits
                </p>
              </div>
            </div>
            <p className="text-sm text-primary-foreground/80 mb-4">
              Share your unique referral code. When a friend signs up with it and makes their
              first real wallet deposit (card or bank transfer), you get ₦1,000 credited
              instantly. The{bonusLabel ? ` ${bonusLabel}` : ""} welcome bonus does not count as a deposit.
            </p>
          </CardContent>
        </Card>

        {/* Referral Code */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Your Referral Code</CardTitle>
            <CardDescription>Share this code with friends to earn rewards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                value={profile?.referral_code || "Loading..."}
                readOnly
                className="font-mono text-lg font-bold text-center"
              />
              <Button variant="outline" size="icon" onClick={copyReferralCode}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={shareReferralLink}>
                <Share2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-3xl font-bold text-foreground">
                {isLoading ? "..." : stats.totalReferrals}
              </p>
              <p className="text-sm text-muted-foreground">Friends Referred</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 text-center">
              <Wallet className="h-8 w-8 mx-auto text-primary mb-2" />
              <p className="text-3xl font-bold text-foreground">
                {isLoading ? "..." : formatCurrency(stats.totalEarnings)}
              </p>
              <p className="text-sm text-muted-foreground">Total Earnings</p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                1
              </div>
              <div>
                <h4 className="font-medium">Share Your Code</h4>
                <p className="text-sm text-muted-foreground">
                  Send your unique referral code to friends and family
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                2
              </div>
              <div>
                <h4 className="font-medium">Friend Signs Up</h4>
                <p className="text-sm text-muted-foreground">
                  They create an account using your referral code{bonusLabel ? ` and get their ${bonusLabel} welcome bonus` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                3
              </div>
              <div>
                <h4 className="font-medium">They Fund Their Wallet</h4>
                <p className="text-sm text-muted-foreground">
                  On their first successful wallet funding, ₦1,000 lands in your wallet automatically
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Eligibility rules</p>
              <p>• Paid once per referred friend — on their first qualifying deposit only.</p>
              <p>• The{bonusLabel ? ` ${bonusLabel}` : ""} welcome bonus is excluded and never triggers a referral payout.</p>
              <p>• The deposit must be a completed wallet top-up (card or virtual account transfer).</p>
              <p>• The referral code must be entered at sign-up; it cannot be added later.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Referrals;
