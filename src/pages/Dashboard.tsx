import { useEffect, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bird, Phone, Wifi, Zap, Tv, Globe, History, Users, LogOut, Wallet, Plus, User, Settings, Building2, Copy, Check, Gift, Bell, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import AdvertBanner from "@/components/AdvertBanner";
import RecentTransactions from "@/components/RecentTransactions";
import PageTransition from "@/components/PageTransition";
import PullToRefresh from "@/components/PullToRefresh";
import NotificationCenter from "@/components/NotificationCenter";

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
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold shadow-gold">
              <Bird className="h-6 w-6 text-secondary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">
              THE <span className="text-gradient-gold">EAGLES</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            <NotificationCenter />
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
      </header>

      <main className="container py-8 pb-24 md:pb-8">
        {/* Welcome Card */}
        <Card className="mb-8 gradient-hero text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold mb-1">
                    Welcome, {profile?.full_name || user.email?.split("@")[0]}! 👋
                  </h1>
                  <p className="text-primary-foreground/80">
                    Ready to recharge? Let's get you connected.
                  </p>
                </div>
                <Link to="/wallet/topup" className="flex items-center gap-3 bg-primary-foreground/10 rounded-xl px-4 py-3 hover:bg-primary-foreground/20 transition-colors cursor-pointer group">
                  <Wallet className="h-6 w-6" />
                  <div className="flex-1">
                    <p className="text-sm text-primary-foreground/80">Wallet Balance</p>
                    <p className="text-xl font-bold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</p>
                  </div>
                  <div className="p-2 rounded-full bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors">
                    <Plus className="h-4 w-4" />
                  </div>
                </Link>
              </div>
              
              {/* Virtual Account Section */}
              {dvaDetails ? <div className="flex items-center gap-3 bg-primary-foreground/5 rounded-xl px-4 py-3 border border-primary-foreground/20">
                  <Building2 className="h-5 w-5 text-primary-foreground/70" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-primary-foreground/60">Your Account</p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{dvaDetails.account_number}</span>
                      <span className="text-sm text-primary-foreground/70">• {dvaDetails.bank_name}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" onClick={handleCopyAccount}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div> : <Link to="/wallet/topup" className="flex items-center gap-3 bg-primary-foreground/5 rounded-xl px-4 py-3 border border-dashed border-primary-foreground/30 hover:bg-primary-foreground/10 transition-colors">
                  <Building2 className="h-5 w-5 text-primary-foreground/50" />
                  <div className="flex-1">
                    <p className="text-sm text-primary-foreground/70">Get a dedicated bank account for instant wallet funding</p>
                  </div>
                  <Plus className="h-4 w-4 text-primary-foreground/50" />
                </Link>}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - Mobile Navigation */}
        <div className="md:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
          <Link to="/wallet/topup">
            <Button variant="default" size="sm" className="whitespace-nowrap gradient-gold text-secondary-foreground">
              <Plus className="h-4 w-4 mr-2" />
              Fund Wallet
            </Button>
          </Link>
          <Link to="/history">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
          </Link>
          <Link to="/referrals">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <Users className="h-4 w-4 mr-2" />
              Referrals
            </Button>
          </Link>
        </div>

        {/* Advert Banner */}
        <AdvertBanner />

        {/* Quick Services Grid */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Services</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Airtime */}
            <Link to="/airtime">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-3">
                    <Phone className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-semibold">Airtime</span>
                </CardContent>
              </Card>
            </Link>

            {/* Data */}
            <Link to="/data">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mb-3">
                    <Wifi className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Data</span>
                </CardContent>
              </Card>
            </Link>

            {/* Refer & Earn */}
            <Link to="/referrals">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500 flex items-center justify-center mb-3">
                    <Gift className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Refer & Earn</span>
                </CardContent>
              </Card>
            </Link>

            {/* Electricity */}
            <Link to="/bills/electricity">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500 flex items-center justify-center mb-3">
                    <Zap className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Electricity</span>
                </CardContent>
              </Card>
            </Link>

            {/* Cable TV */}
            <Link to="/bills/cable">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-blue-500 flex items-center justify-center mb-3">
                    <Tv className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Cable TV</span>
                </CardContent>
              </Card>
            </Link>

            {/* Internet */}
            <Link to="/bills/internet">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-violet-500 flex items-center justify-center mb-3">
                    <Globe className="h-7 w-7 text-white" />
                  </div>
                  <span className="text-sm font-semibold">Internet</span>
                </CardContent>
              </Card>
            </Link>

            {/* Wallet Top-up */}
            <Link to="/wallet/topup">
              <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                <CardContent className="p-6 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center mb-3">
                    <Wallet className="h-7 w-7 text-accent-foreground" />
                  </div>
                  <span className="text-sm font-semibold">Top Up</span>
                </CardContent>
              </Card>
            </Link>

          </div>
        </div>
        {/* Recent Transactions */}
        <RecentTransactions key={refreshKey} />

      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border z-50">
        <div className="flex items-center justify-around py-2 px-4">
          <Link to="/dashboard" className="flex flex-col items-center gap-1 py-2 px-3 text-primary">
            <Wallet className="h-5 w-5" />
            <span className="text-xs font-medium">Home</span>
          </Link>
          <Link to="/history" className="flex flex-col items-center gap-1 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors">
            <History className="h-5 w-5" />
            <span className="text-xs font-medium">History</span>
          </Link>
          <Link to="/referrals" className="flex flex-col items-center gap-1 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors">
            <Users className="h-5 w-5" />
            <span className="text-xs font-medium">Referrals</span>
          </Link>
          <Link to="/profile" className="flex flex-col items-center gap-1 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors">
            <User className="h-5 w-5" />
            <span className="text-xs font-medium">Profile</span>
          </Link>
          <Link to="/settings" className="flex flex-col items-center gap-1 py-2 px-3 text-muted-foreground hover:text-foreground transition-colors">
            <Settings className="h-5 w-5" />
            <span className="text-xs font-medium">Settings</span>
          </Link>
        </div>
      </nav>
    </div></PullToRefresh></PageTransition>;
};
export default Dashboard;