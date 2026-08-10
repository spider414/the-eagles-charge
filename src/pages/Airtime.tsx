import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import AirtimeForm from "@/components/AirtimeForm";
import PageTransition from "@/components/PageTransition";

// Import network logos
import mtnLogo from "@/assets/networks/mtn-logo.png";
import gloLogo from "@/assets/networks/glo-logo.png";
import airtelLogo from "@/assets/networks/airtel-logo.png";
import nineMobileLogo from "@/assets/networks/9mobile-logo.png";

const Airtime = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

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

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg">
                <Phone className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">
                Buy <span className="text-gradient-gold">Airtime</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-lg pb-24">
        {/* Network Logos */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-1">
              <img src={mtnLogo} alt="MTN" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-xs font-medium">MTN</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-green-600/10 flex items-center justify-center mb-1">
              <img src={gloLogo} alt="GLO" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-xs font-medium">GLO</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-red-600/10 flex items-center justify-center mb-1">
              <img src={airtelLogo} alt="Airtel" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-xs font-medium">Airtel</span>
          </div>
          <div className="flex flex-col items-center">
            <div className="w-14 h-14 rounded-xl bg-green-500/10 flex items-center justify-center mb-1">
              <img src={nineMobileLogo} alt="9mobile" className="w-10 h-10 object-contain" />
            </div>
            <span className="text-xs font-medium">9mobile</span>
          </div>
        </div>

        {/* Airtime Form */}
        <AirtimeForm />
      </main>
    </div>
    </PageTransition>
  );
};

export default Airtime;
