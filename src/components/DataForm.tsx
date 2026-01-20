import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, Check } from "lucide-react";
import NetworkSelector, { NetworkType } from "./NetworkSelector";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useAuth } from "@/contexts/AuthContext";

interface DataPlan {
  id: string;
  size: string;
  price: number;
  validity: string;
}

const dataPlans: Record<NetworkType, DataPlan[]> = {
  mtn: [
    { id: "mtn-1", size: "500MB", price: 150, validity: "30 days" },
    { id: "mtn-2", size: "1GB", price: 300, validity: "30 days" },
    { id: "mtn-3", size: "2GB", price: 500, validity: "30 days" },
    { id: "mtn-4", size: "3GB", price: 800, validity: "30 days" },
    { id: "mtn-5", size: "5GB", price: 1200, validity: "30 days" },
    { id: "mtn-6", size: "10GB", price: 2500, validity: "30 days" },
  ],
  glo: [
    { id: "glo-1", size: "500MB", price: 100, validity: "30 days" },
    { id: "glo-2", size: "1GB", price: 200, validity: "30 days" },
    { id: "glo-3", size: "2GB", price: 400, validity: "30 days" },
    { id: "glo-4", size: "5GB", price: 1000, validity: "30 days" },
    { id: "glo-5", size: "10GB", price: 2000, validity: "30 days" },
  ],
  airtel: [
    { id: "airtel-1", size: "500MB", price: 150, validity: "30 days" },
    { id: "airtel-2", size: "1GB", price: 300, validity: "30 days" },
    { id: "airtel-3", size: "2GB", price: 500, validity: "30 days" },
    { id: "airtel-4", size: "5GB", price: 1200, validity: "30 days" },
    { id: "airtel-5", size: "10GB", price: 2500, validity: "30 days" },
  ],
  "9mobile": [
    { id: "9mobile-1", size: "500MB", price: 100, validity: "30 days" },
    { id: "9mobile-2", size: "1GB", price: 200, validity: "30 days" },
    { id: "9mobile-3", size: "2.5GB", price: 500, validity: "30 days" },
    { id: "9mobile-4", size: "5GB", price: 1000, validity: "30 days" },
    { id: "9mobile-5", size: "11.5GB", price: 2000, validity: "30 days" },
  ],
};

const DataForm = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { initializePayment, isLoading } = usePaystack();

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

    if (!network) {
      toast({
        title: "Select a network",
        description: "Please select a network provider",
        variant: "destructive",
      });
      return;
    }

    if (!phone || phone.length !== 11) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid 11-digit phone number",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPlan) {
      toast({
        title: "Select a plan",
        description: "Please select a data plan",
        variant: "destructive",
      });
      return;
    }

    await initializePayment({
      amount: selectedPlan.price,
      email: user.email || "",
      metadata: {
        transaction_type: "data",
        phone_number: phone,
        network: network,
        data_plan: selectedPlan.size,
      },
    });
  };

  const currentPlans = network ? dataPlans[network] : [];

  return (
    <Card className="shadow-card border-2 border-border hover:border-primary/20 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          Buy Data Bundle
        </CardTitle>
        <CardDescription>
          Affordable data plans for all Nigerian networks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label>Select Network</Label>
            <NetworkSelector
              selected={network}
              onSelect={(n) => {
                setNetwork(n);
                setSelectedPlan(null);
              }}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="data-phone">Phone Number</Label>
            <Input
              id="data-phone"
              type="tel"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              className="h-12"
            />
          </div>

          {network && (
            <div className="space-y-3 animate-fade-in">
              <Label>Select Data Plan</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                    <div className="text-lg font-bold text-foreground">{plan.size}</div>
                    <div className="text-xl font-extrabold text-primary">
                      ₦{plan.price.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{plan.validity}</div>
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
              : "Select a Plan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DataForm;
