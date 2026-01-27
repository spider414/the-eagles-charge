import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, Check, Loader2, Mail, AlertCircle } from "lucide-react";
import NetworkSelector, { NetworkType } from "./NetworkSelector";
import PaymentMethodSelector, { PaymentMethod } from "./PaymentMethodSelector";
import FavoriteNumbersSelector from "./FavoriteNumbersSelector";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useFavoriteNumbers } from "@/hooks/useFavoriteNumbers";
import { useAuth } from "@/contexts/AuthContext";
import { detectNetwork } from "@/utils/phoneUtils";
import { useDataPlans, DataPlan } from "@/hooks/useDataPlans";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";

const DataForm = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const [paymentEmail, setPaymentEmail] = useState("");
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const { initializePayment, isLoading: paystackLoading } = usePaystack();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { addFavorite } = useFavoriteNumbers();

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.endsWith("@eagles.local");

  // Get email suggestion for typos
  const emailSuggestion = getEmailSuggestion(paymentEmail);

  // Pre-fill payment email from profile if valid
  useEffect(() => {
    if (profile?.email && isValidEmail(profile.email)) {
      setPaymentEmail(profile.email);
    }
  }, [profile]);

  // Save payment email to profile
  const savePaymentEmail = async (email: string) => {
    if (!user) return;
    try {
      await supabase.from("profiles").update({ email }).eq("user_id", user.id);
      await refreshProfile();
    } catch (err) {
      console.error("Error saving email:", err);
    }
  };
  const { plans: currentPlans, isLoading: plansLoading, fetchPlans } = useDataPlans();

  const isLoading = paystackLoading || walletLoading;

  // Fetch plans when network changes
  useEffect(() => {
    if (network) {
      fetchPlans(network);
      setSelectedPlan(null);
    }
  }, [network, fetchPlans]);

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phone.length >= 4) {
      const detected = detectNetwork(phone);
      if (detected && detected !== network) {
        setNetwork(detected);
      }
    }
  }, [phone, network]);

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
      variation_id: selectedPlan.variation_id,
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
      // Get valid email for card payment
      const validEmail = hasSyntheticEmail() 
        ? (isValidEmail(paymentEmail) ? paymentEmail : null)
        : (isValidEmail(user.email || "") ? user.email : null);

      if (!validEmail) {
        toast({
          title: "Email Required",
          description: hasSyntheticEmail()
            ? "Please enter a valid email address for card payments."
            : "Please update your profile with a valid email address.",
          variant: "destructive",
        });
        return;
      }

      // Save email to profile if different
      if (hasSyntheticEmail() && validEmail !== profile?.email) {
        await savePaymentEmail(validEmail);
      }

      await initializePayment({
        amount: selectedPlan.price,
        email: validEmail,
        metadata,
      });
    }
  };

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
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground">Loading plans...</span>
                </div>
              ) : (
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
              )}
            </div>
          )}

          {user && selectedPlan && hasSyntheticEmail() && paymentMethod === "paystack" && (
            <div className="space-y-2">
              <Label htmlFor="data-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email for Payment Receipt
              </Label>
              <Input
                id="data-email"
                type="email"
                placeholder="Enter your email address"
                value={paymentEmail}
                onChange={(e) => setPaymentEmail(e.target.value)}
                className={`h-12 ${paymentEmail && !isValidEmail(paymentEmail) ? 'border-destructive' : ''}`}
              />
              {emailSuggestion && (
                <button
                  type="button"
                  onClick={() => setPaymentEmail(emailSuggestion)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <AlertCircle className="h-3 w-3" />
                  Did you mean {emailSuggestion}?
                </button>
              )}
              {paymentEmail && !isValidEmail(paymentEmail) && !emailSuggestion && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Please enter a valid email address
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Required for card payments. Will be saved to your profile.
              </p>
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
