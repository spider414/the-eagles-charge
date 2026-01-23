import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, Check } from "lucide-react";
import NetworkSelector, { NetworkType } from "./NetworkSelector";
import PaymentMethodSelector, { PaymentMethod } from "./PaymentMethodSelector";
import FavoriteNumbersSelector from "./FavoriteNumbersSelector";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useFavoriteNumbers } from "@/hooks/useFavoriteNumbers";
import { useAuth } from "@/contexts/AuthContext";
import { detectNetwork } from "@/utils/phoneUtils";

interface DataPlan {
  id: string;
  size: string;
  price: number;
  validity: string;
}

// Data plans with VTU API variation codes
const dataPlans: Record<NetworkType, DataPlan[]> = {
  mtn: [
    { id: "mtn-500mb", size: "500MB", price: 150, validity: "30 days" },
    { id: "mtn-1gb", size: "1GB", price: 300, validity: "30 days" },
    { id: "mtn-2gb", size: "2GB", price: 500, validity: "30 days" },
    { id: "mtn-3gb", size: "3GB", price: 800, validity: "30 days" },
    { id: "mtn-5gb", size: "5GB", price: 1200, validity: "30 days" },
    { id: "mtn-10gb", size: "10GB", price: 2500, validity: "30 days" },
  ],
  glo: [
    { id: "glo-500mb", size: "500MB", price: 100, validity: "30 days" },
    { id: "glo-1gb", size: "1GB", price: 200, validity: "30 days" },
    { id: "glo-2gb", size: "2GB", price: 400, validity: "30 days" },
    { id: "glo-5gb", size: "5GB", price: 1000, validity: "30 days" },
    { id: "glo-10gb", size: "10GB", price: 2000, validity: "30 days" },
  ],
  airtel: [
    { id: "airtel-500mb", size: "500MB", price: 150, validity: "30 days" },
    { id: "airtel-1gb", size: "1GB", price: 300, validity: "30 days" },
    { id: "airtel-2gb", size: "2GB", price: 500, validity: "30 days" },
    { id: "airtel-5gb", size: "5GB", price: 1200, validity: "30 days" },
    { id: "airtel-10gb", size: "10GB", price: 2500, validity: "30 days" },
  ],
  "9mobile": [
    { id: "9mobile-500mb", size: "500MB", price: 100, validity: "30 days" },
    { id: "9mobile-1gb", size: "1GB", price: 200, validity: "30 days" },
    { id: "9mobile-2.5gb", size: "2.5GB", price: 500, validity: "30 days" },
    { id: "9mobile-5gb", size: "5GB", price: 1000, validity: "30 days" },
    { id: "9mobile-11.5gb", size: "11.5GB", price: 2000, validity: "30 days" },
  ],
};

const DataForm = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const { toast } = useToast();
  const { user } = useAuth();
  const { initializePayment, isLoading: paystackLoading } = usePaystack();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { addFavorite } = useFavoriteNumbers();

  const isLoading = paystackLoading || walletLoading;

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phone.length >= 4) {
      const detected = detectNetwork(phone);
      if (detected && detected !== network) {
        setNetwork(detected);
        setSelectedPlan(null);
      }
    }
  }, [phone]);

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    setPhone(cleaned);
  };

  const handleFavoriteSelect = (selectedPhone: string, selectedNetwork: NetworkType) => {
    setPhone(selectedPhone);
    setNetwork(selectedNetwork);
    setSelectedPlan(null);
  };

  const handleSaveNumber = async () => {
    if (phone.length === 11 && network) {
      await addFavorite(phone, network);
    }
  };

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

    const metadata = {
      transaction_type: "data" as const,
      phone_number: phone,
      network: network,
      data_plan: selectedPlan.size,
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: selectedPlan.price,
        metadata,
      });
      if (success) {
        setPhone("");
        setSelectedPlan(null);
        setNetwork(null);
      }
    } else {
      await initializePayment({
        amount: selectedPlan.price,
        email: user.email || "",
        metadata,
      });
    }
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
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-12"
            />
            <FavoriteNumbersSelector
              onSelect={handleFavoriteSelect}
              currentPhone={phone}
              currentNetwork={network}
              onSaveCurrentNumber={handleSaveNumber}
              canSave={true}
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

          {user && selectedPlan && (
            <PaymentMethodSelector
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              walletBalance={walletBalance}
              amount={selectedPlan.price}
            />
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isLoading || !selectedPlan}>
            {isLoading
              ? "Processing..."
              : selectedPlan
              ? paymentMethod === "wallet"
                ? `Pay ₦${selectedPlan.price.toLocaleString()} from Wallet`
                : `Pay ₦${selectedPlan.price.toLocaleString()}`
              : "Select a Plan"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default DataForm;
