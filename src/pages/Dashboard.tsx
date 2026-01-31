import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bird, Phone, Wifi, Zap, Tv, Globe, History, Users, LogOut, Wallet, Plus, User, Settings, Building2, Copy, Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AirtimeForm from "@/components/AirtimeForm";
import DataForm from "@/components/DataForm";

// Import network logos
import mtnLogo from "@/assets/networks/mtn-logo.png";
import gloLogo from "@/assets/networks/glo-logo.png";
import airtelLogo from "@/assets/networks/airtel-logo.png";
import nineMobileLogo from "@/assets/networks/9mobile-logo.png";

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
    signOut
  } = useAuth();
  const {
    toast
  } = useToast();
  const [dvaDetails, setDvaDetails] = useState<DVADetails | null>(null);
  const [copied, setCopied] = useState(false);
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
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>;
  }
  if (!user) {
    return null;
  }
  const services = [{
    name: "Electricity",
    icon: Zap,
    href: "/bills/electricity",
    color: "text-yellow-600"
  }, {
    name: "Cable TV",
    icon: Tv,
    href: "/bills/cable",
    color: "text-blue-600"
  }, {
    name: "Internet",
    icon: Globe,
    href: "/bills/internet",
    color: "text-purple-600"
  }];
  return <div className="min-h-screen bg-background">
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

          <nav className="flex items-center gap-2">
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

        {/* Mobile Services - Airtime & Data */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Mobile Services</h2>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-1">
                <img src={mtnLogo} alt="MTN" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-xs font-medium">MTN</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-green-600/10 flex items-center justify-center mb-1">
                <img src={gloLogo} alt="GLO" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-xs font-medium">GLO</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-red-600/10 flex items-center justify-center mb-1">
                <img src={airtelLogo} alt="Airtel" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-xs font-medium">Airtel</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-1">
                <img src={nineMobileLogo} alt="9mobile" className="w-8 h-8 object-contain" />
              </div>
              <span className="text-xs font-medium">9mobile</span>
            </div>
          </div>
          
          {/* Airtime & Data Forms */}
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
              <AirtimeForm />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
              <DataForm />
            </div>
          </div>
        </div>

        {/* Bill Payment Services */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Bill Payments</h2>
          <div className="grid grid-cols-3 gap-4">
            {services.map(service => <Link key={service.name} to={service.href}>
                <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className={`p-3 rounded-xl bg-muted mb-2 ${service.color}`}>
                      <service.icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">{service.name}</span>
                  </CardContent>
                </Card>
              </Link>)}
          </div>
        </div>
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
    </div>;
};
export default Dashboard;