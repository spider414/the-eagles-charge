import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bird, Phone, Wifi, Zap, Tv, Globe, History, Users, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import AirtimeForm from "@/components/AirtimeForm";
import DataForm from "@/components/DataForm";

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, signOut } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const services = [
    { name: "Electricity", icon: Zap, href: "/bills/electricity", color: "text-yellow-600" },
    { name: "Cable TV", icon: Tv, href: "/bills/cable", color: "text-blue-600" },
    { name: "Internet", icon: Globe, href: "/bills/internet", color: "text-purple-600" },
  ];

  return (
    <div className="min-h-screen bg-background">
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

          <nav className="flex items-center gap-4">
            <Link to="/history" className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <History className="h-4 w-4" />
              History
            </Link>
            <Link to="/referrals" className="hidden md:flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              <Users className="h-4 w-4" />
              Referrals
            </Link>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </nav>
        </div>
      </header>

      <main className="container py-8">
        {/* Welcome Card */}
        <Card className="mb-8 gradient-hero text-primary-foreground">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  Welcome, {profile?.full_name || user.email?.split("@")[0]}! 👋
                </h1>
                <p className="text-primary-foreground/80">
                  Ready to recharge? Let's get you connected.
                </p>
              </div>
              <div className="flex items-center gap-3 bg-primary-foreground/10 rounded-xl px-4 py-3">
                <Wallet className="h-6 w-6" />
                <div>
                  <p className="text-sm text-primary-foreground/80">Wallet Balance</p>
                  <p className="text-xl font-bold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions - Mobile Navigation */}
        <div className="md:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
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

        {/* Bill Payment Services */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Bill Payments</h2>
          <div className="grid grid-cols-3 gap-4">
            {services.map((service) => (
              <Link key={service.name} to={service.href}>
                <Card className="hover:shadow-card hover:border-primary/20 transition-all cursor-pointer h-full">
                  <CardContent className="p-4 flex flex-col items-center text-center">
                    <div className={`p-3 rounded-xl bg-muted mb-2 ${service.color}`}>
                      <service.icon className="h-6 w-6" />
                    </div>
                    <span className="text-sm font-medium">{service.name}</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Airtime & Data Forms */}
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="animate-fade-in" style={{ animationDelay: "100ms" }}>
            <AirtimeForm />
          </div>
          <div className="animate-fade-in" style={{ animationDelay: "200ms" }}>
            <DataForm />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
