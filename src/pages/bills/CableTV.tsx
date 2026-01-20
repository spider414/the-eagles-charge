import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Tv, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";

interface CablePlan {
  id: string;
  name: string;
  price: number;
  provider: "dstv" | "gotv" | "startimes";
}

const cablePlans: Record<string, CablePlan[]> = {
  dstv: [
    { id: "dstv-padi", name: "DStv Padi", price: 2500, provider: "dstv" },
    { id: "dstv-yanga", name: "DStv Yanga", price: 3500, provider: "dstv" },
    { id: "dstv-confam", name: "DStv Confam", price: 6200, provider: "dstv" },
    { id: "dstv-compact", name: "DStv Compact", price: 10500, provider: "dstv" },
    { id: "dstv-compact-plus", name: "DStv Compact Plus", price: 16600, provider: "dstv" },
    { id: "dstv-premium", name: "DStv Premium", price: 24500, provider: "dstv" },
  ],
  gotv: [
    { id: "gotv-smallie", name: "GOtv Smallie", price: 1100, provider: "gotv" },
    { id: "gotv-jinja", name: "GOtv Jinja", price: 2250, provider: "gotv" },
    { id: "gotv-jolli", name: "GOtv Jolli", price: 3300, provider: "gotv" },
    { id: "gotv-max", name: "GOtv Max", price: 4850, provider: "gotv" },
    { id: "gotv-supa", name: "GOtv Supa", price: 6400, provider: "gotv" },
  ],
  startimes: [
    { id: "startimes-nova", name: "StarTimes Nova", price: 1200, provider: "startimes" },
    { id: "startimes-basic", name: "StarTimes Basic", price: 1850, provider: "startimes" },
    { id: "startimes-smart", name: "StarTimes Smart", price: 2600, provider: "startimes" },
    { id: "startimes-classic", name: "StarTimes Classic", price: 2750, provider: "startimes" },
    { id: "startimes-super", name: "StarTimes Super", price: 4900, provider: "startimes" },
  ],
};

const providers = [
  { id: "dstv", name: "DStv", color: "bg-blue-600" },
  { id: "gotv", name: "GOtv", color: "bg-green-600" },
  { id: "startimes", name: "StarTimes", color: "bg-orange-600" },
];

const CableTV = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading } = usePaystack();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CablePlan | null>(null);
  const [smartcardNumber, setSmartcardNumber] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Login Required",
        description: "Please login to make a purchase",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    if (!selectedProvider || !selectedPlan || !smartcardNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    await initializePayment({
      amount: selectedPlan.price,
      email: user.email || "",
      metadata: {
        transaction_type: "cable_tv",
        cable_provider: selectedPlan.provider,
        cable_smartcard: smartcardNumber,
        cable_plan: selectedPlan.name,
      },
    });
  };

  const currentPlans = selectedProvider ? cablePlans[selectedProvider] : [];

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
              <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold shadow-gold">
                <Bird className="h-6 w-6 text-secondary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">
                Cable <span className="text-gradient-gold">TV</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-lg">
        <Card className="shadow-card border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tv className="h-5 w-5 text-blue-600" />
              Cable TV Subscription
            </CardTitle>
            <CardDescription>
              Renew DStv, GOtv, or StarTimes subscriptions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <Label>Select Provider</Label>
                <div className="grid grid-cols-3 gap-3">
                  {providers.map((provider) => (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        setSelectedPlan(null);
                      }}
                      className={`relative p-4 rounded-xl border-2 text-center transition-all ${
                        selectedProvider === provider.id
                          ? "border-primary bg-accent shadow-card"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {selectedProvider === provider.id && (
                        <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                      )}
                      <div className={`w-10 h-10 rounded-lg ${provider.color} mx-auto mb-2 flex items-center justify-center`}>
                        <Tv className="h-5 w-5 text-white" />
                      </div>
                      <span className="text-sm font-medium">{provider.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Smartcard Number */}
              <div className="space-y-3">
                <Label htmlFor="smartcard">Smartcard / IUC Number</Label>
                <Input
                  id="smartcard"
                  type="text"
                  placeholder="Enter smartcard number"
                  value={smartcardNumber}
                  onChange={(e) => setSmartcardNumber(e.target.value.replace(/\D/g, ""))}
                  className="h-12"
                />
              </div>

              {/* Plan Selection */}
              {selectedProvider && (
                <div className="space-y-3 animate-fade-in">
                  <Label>Select Package</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {currentPlans.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan)}
                        className={`relative p-4 rounded-xl border-2 text-left transition-all ${
                          selectedPlan?.id === plan.id
                            ? "border-primary bg-accent shadow-card"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
                      >
                        {selectedPlan?.id === plan.id && (
                          <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
                        )}
                        <div className="text-sm font-medium text-foreground">{plan.name}</div>
                        <div className="text-lg font-bold text-primary">
                          ₦{plan.price.toLocaleString()}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isLoading || !selectedPlan}>
                {isLoading
                  ? "Processing..."
                  : selectedPlan
                  ? `Pay ₦${selectedPlan.price.toLocaleString()}`
                  : "Select a Package"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default CableTV;
