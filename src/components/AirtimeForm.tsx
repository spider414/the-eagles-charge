import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Wallet, Mail, AlertCircle } from "lucide-react";
import NetworkSelector, { NetworkType } from "./NetworkSelector";
import PaymentMethodSelector, { PaymentMethod } from "./PaymentMethodSelector";
import FavoriteNumbersSelector from "./FavoriteNumbersSelector";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useFavoriteNumbers } from "@/hooks/useFavoriteNumbers";
import { useAuth } from "@/contexts/AuthContext";
import { detectNetwork } from "@/utils/phoneUtils";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";

const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

const AirtimeForm = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
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

  const isLoading = paystackLoading || walletLoading;

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phone.length >= 4) {
      const detected = detectNetwork(phone);
      if (detected) {
        setNetwork(detected);
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

    if (!amount || Number(amount) < 50) {
      toast({
        title: "Invalid amount",
        description: "Minimum recharge amount is ₦50",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      transaction_type: "airtime" as const,
      phone_number: phone,
      network: network,
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: Number(amount),
        metadata,
      });
      if (success) {
        setPhone("");
        setAmount("");
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
        amount: Number(amount),
        email: validEmail,
        metadata,
      });
    }
  };

  return (
    <Card className="shadow-card border-2 border-border hover:border-primary/20 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" />
          Buy Airtime
        </CardTitle>
        <CardDescription>
          Instant airtime top-up for all Nigerian networks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label>Select Network</Label>
            <NetworkSelector selected={network} onSelect={setNetwork} />
          </div>

          <div className="space-y-3">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
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

          <div className="space-y-3">
            <Label htmlFor="amount">Amount (₦)</Label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 pl-10"
                min={50}
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                    amount === String(amt)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {user && hasSyntheticEmail() && paymentMethod === "paystack" && (
            <div className="space-y-2">
              <Label htmlFor="airtime-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email for Payment Receipt
              </Label>
              <Input
                id="airtime-email"
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

          {user && (
            <PaymentMethodSelector
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              walletBalance={walletBalance}
              amount={Number(amount) || 0}
            />
          )}

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading 
              ? "Processing..." 
              : paymentMethod === "wallet"
              ? `Pay ₦${Number(amount || 0).toLocaleString()} from Wallet`
              : `Pay ₦${Number(amount || 0).toLocaleString()}`
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AirtimeForm;
