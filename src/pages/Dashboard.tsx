import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { Phone, Wifi, Zap, Tv, Globe, History, Users, LogOut, Wallet, Plus, User, Settings, Building2, Copy, Check, Gift, Bell, BookOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AdvertBanner from "@/components/AdvertBanner";
import RecentTransactions from "@/components/RecentTransactions";
import PageTransition from "@/components/PageTransition";
import PullToRefresh from "@/components/PullToRefresh";
import NotificationCenter from "@/components/NotificationCenter";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import BrandLogo from "@/components/BrandLogo";

interface DVADetails {
  account_number: string;
  account_name: string;
  bank_name: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const {
    user,
    profile,
    isLoading,
    signOut,
    refreshProfile
  } = useAuth();
  const { isAdmin } = useIsAdmin();
  const {
    toast
  } = useToast();
  const [dvaDetails, setDvaDetails] = useState<DVADetails | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  // Fetch DVA details from profile
  useEffect(() => {
    if (profile?.dva_account_number && profile?.dva_bank_name) {
      setDvaDetails({
        account_number: profile.dva_account_number,
        account_name: profile.dva_account_name || profile.full_name || "",
        bank_name: profile.dva_bank_name
      });
    }
  }, [profile]);
  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };
  const handleCopyAccount = async () => {
    if (dvaDetails?.account_number) {
      await navigator.clipboard.writeText(dvaDetails.account_number);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Account number copied"
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRefresh = useCallback(async () => {
    try {
      if (refreshProfile) {
        await refreshProfile();
      }
      // Trigger re-fetch of transactions by updating the key
      setRefreshKey(prev => prev + 1);
      toast({
        title: "Refreshed!",
        description: "Dashboard updated successfully",
      });
    } catch (error) {
      console.error("Refresh error:", error);
    }
  }, [refreshProfile, toast]);
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>;
  }
  if (!user) {
    return null;
  }
  return <PageTransition><PullToRefresh onRefresh={handleRefresh} className="min-h-screen"><div className="min-h-screen bg-background">
      {/* Render outside the pull-to-refresh transform so it stays viewport-locked. */}
      {createPortal(<header className="fixed top-0 left-0 right-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur-xl overscroll-none touch-none pt-[env(safe-area-inset-top)]">
        <div className="container flex h-14 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" rounded="rounded-lg" />
            <span className="text-lg font-bold text-foreground">
              HARMIC <span className="text-gradient-gold">RECHARGE</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <NotificationCenter />
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-2"
                aria-label="Admin panel"
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden md:inline">Admin</span>
              </Link>
            )}
            <Link to="/history" className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              <History className="h-4 w-4" />
              History
            </Link>
            <Link to="/referrals" className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
              <Users className="h-4 w-4" />
              Referrals
            </Link>
            <Link to="/profile" className="hidden md:flex">
              <Button variant="ghost" size="icon">
                <User className="h-5 w-5" />
              </Button>
            </Link>
            <Link to="/settings" className="hidden md:flex">
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="hidden md:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>, document.body)}

      <main className="container pt-20 pb-6 pb-20 md:pb-6">
        {/* Welcome Card */}
        <Card className="mb-3 gradient-hero text-primary-foreground">
          <CardContent className="p-2.5">
            <div className="flex flex-col gap-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <h1 className="text-base font-semibold mb-0.5">
                    Welcome, {profile?.full_name || user.email?.split("@")[0]}! 👋
                  </h1>
                  <p className="text-[10px] text-primary-foreground/80">
                    Ready to recharge? Let's get you connected.
                  </p>
                </div>
                <Link to="/wallet/topup" className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-2.5 py-1.5 hover:bg-primary-foreground/20 transition-colors cursor-pointer group">
                  <Wallet className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="text-[10px] text-primary-foreground/80">Wallet Balance</p>
                    <p className="text-xs font-bold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</p>
                  </div>
                  <div className="p-1 rounded-full bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors">
                    <Plus className="h-3 w-3" />
                  </div>
                </Link>
              </div>
              
              {/* Virtual Account Section */}
              {dvaDetails ? <div className="flex items-center gap-3 bg-primary-foreground/5 rounded-xl px-3 py-2 border border-primary-foreground/20">
                  <Building2 className="h-4 w-4 text-primary-foreground/70" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-primary-foreground/60">Your Account</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{dvaDetails.account_number}</span>
                      <span className="text-xs text-primary-foreground/70">• {dvaDetails.bank_name}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={handleCopyAccount}>
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div> : <Link to="/wallet/topup" className="flex items-center gap-3 bg-primary-foreground/5 rounded-xl px-3 py-2 border border-dashed border-primary-foreground/30 hover:bg-primary-foreground/10 transition-colors">
                  <Building2 className="h-4 w-4 text-primary-foreground/50" />
                  <div className="flex-1">
                    <p className="text-xs text-primary-foreground/70">Get a dedicated bank account for instant wallet funding</p>
                  </div>
                  <Plus className="h-3.5 w-3.5 text-primary-foreground/50" />
                </Link>}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - Mobile Navigation */}
        <div className="md:hidden flex gap-1.5 mb-4 overflow-x-auto pb-2">
          <Link to="/wallet/topup">
            <Button variant="default" size="sm" className="whitespace-nowrap gradient-gold text-secondary-foreground h-7 px-2.5 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Fund Wallet
            </Button>
          </Link>
          <Link to="/history">
            <Button variant="outline" size="sm" className="whitespace-nowrap h-7 px-2.5 text-xs">
              <History className="h-3.5 w-3.5 mr-1.5" />
              History
            </Button>
          </Link>
          <Link to="/referrals">
            <Button variant="outline" size="sm" className="whitespace-nowrap h-7 px-2.5 text-xs">
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Referrals
            </Button>
          </Link>
        </div>

        {/* Advert Banner */}
        <AdvertBanner />

        {/* Quick Services Grid */}
        <div className="mb-5">
          <h2 className="text-base font-semibold mb-2">Services</h2>
          <div className="grid grid-cols-2 gap-2">
            {/* Airtime */}
            <Link to="/airtime">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-1.5">
                    <Phone className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-[10px] font-semibold">Airtime</span>
                </CardContent>
              </Card>
            </Link>

            {/* Data */}
            <Link to="/data">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center mb-1.5">
                    <Wifi className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold">Data</span>
                </CardContent>
              </Card>
            </Link>

            {/* Refer & Earn */}
            <Link to="/referrals">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center mb-1.5">
                    <Gift className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold">Refer & Earn</span>
                </CardContent>
              </Card>
            </Link>

            {/* Electricity */}
            <Link to="/bills/electricity">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500 flex items-center justify-center mb-1.5">
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold">Electricity</span>
                </CardContent>
              </Card>
            </Link>

            {/* Cable TV */}
            <Link to="/bills/cable">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center mb-1.5">
                    <Tv className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold">Cable TV</span>
                </CardContent>
              </Card>
            </Link>

            {/* Internet */}
            <Link to="/bills/internet">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center mb-1.5">
                    <Globe className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold">Internet</span>
                </CardContent>
              </Card>
            </Link>

            {/* Exam PINs */}
            <Link to="/exam-pin">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center mb-1.5">
                    <BookOpen className="h-4 w-4 text-white" />
                  </div>
                  <span className="text-[10px] font-semibold">Exam PINs</span>
                </CardContent>
              </Card>
            </Link>

            {/* Wallet Top-up */}
            <Link to="/wallet/topup">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-2 flex flex-col items-center text-center">
                  <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-1.5">
                    <Wallet className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <span className="text-[10px] font-semibold">Top Up</span>
                </CardContent>
              </Card>
            </Link>

          </div>
        </div>
        {/* Recent Transactions */}
        <RecentTransactions key={refreshKey} />

      </main>

      {/* Render outside the pull-to-refresh transform so it stays viewport-locked. */}
      {createPortal(<nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border z-50 pb-[env(safe-area-inset-bottom)] overscroll-none touch-none">
        <div className="flex items-center justify-around py-1.5 px-2">
          <Link to="/dashboard" className="flex flex-col items-center gap-0.5 py-1.5 px-2 text-primary">
            <Wallet className="h-4 w-4" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link to="/history" className="flex flex-col items-center gap-0.5 py-1.5 px-2 text-muted-foreground hover:text-foreground transition-colors">
            <History className="h-4 w-4" />
            <span className="text-[10px] font-medium">History</span>
          </Link>
          <Link to="/referrals" className="flex flex-col items-center gap-0.5 py-1.5 px-2 text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-4 w-4" />
            <span className="text-[10px] font-medium">Referrals</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center gap-0.5 py-1.5 px-2 text-muted-foreground hover:text-foreground transition-colors">
            <User className="h-4 w-4" />
            <span className="text-[10px] font-medium">Profile</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center gap-0.5 py-1.5 px-2 text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-4 w-4" />
            <span className="text-[10px] font-medium">Settings</span>
          </Link>
        </div>
      </nav>, document.body)}
    </div></PullToRefresh></PageTransition>;
};
export default Dashboard;