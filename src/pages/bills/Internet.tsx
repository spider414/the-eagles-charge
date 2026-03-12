import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Globe, Check, Mail, AlertCircle, Loader2, User, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useInternetVerification } from "@/hooks/useInternetVerification";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import PaymentMethodSelector, { PaymentMethod } from "@/components/PaymentMethodSelector";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";

interface InternetPlan {
  id: string;
  name: string;
  price: number;
  data: string;
  validity: string;
}

const internetProviders = [
  { id: "smile", name: "Smile" },
  { id: "spectranet", name: "Spectranet" },
  { id: "ipnx", name: "iPNX" },
  { id: "swift", name: "Swift 4G" },
  { id: "ntel", name: "ntel" },
];

const plansByProvider: Record<string, InternetPlan[]> = {
  smile: [
    { id: "smile-1", name: "Smile 1.5GB", price: 1000, data: "1.5GB", validity: "30 Days" },
    { id: "smile-2", name: "Smile 3GB", price: 1500, data: "3GB", validity: "30 Days" },
    { id: "smile-3", name: "Smile 6.5GB", price: 2500, data: "6.5GB", validity: "30 Days" },
    { id: "smile-4", name: "Smile 10GB", price: 3500, data: "10GB", validity: "30 Days" },
  ],
  spectranet: [
    { id: "spectranet-1", name: "Spectranet 7GB", price: 3000, data: "7GB", validity: "30 Days" },
    { id: "spectranet-2", name: "Spectranet 15GB", price: 5000, data: "15GB", validity: "30 Days" },
    { id: "spectranet-3", name: "Spectranet 30GB", price: 8000, data: "30GB", validity: "30 Days" },
    { id: "spectranet-4", name: "Spectranet Unlimited", price: 15000, data: "Unlimited", validity: "30 Days" },
  ],
  ipnx: [
    { id: "ipnx-1", name: "iPNX Bronze 15Mbps", price: 12000, data: "Unlimited", validity: "30 Days" },
    { id: "ipnx-2", name: "iPNX Silver 25Mbps", price: 18000, data: "Unlimited", validity: "30 Days" },
    { id: "ipnx-3", name: "iPNX Gold 50Mbps", price: 25000, data: "Unlimited", validity: "30 Days" },
    { id: "ipnx-4", name: "iPNX Platinum 100Mbps", price: 45000, data: "Unlimited", validity: "30 Days" },
  ],
  swift: [
    { id: "swift-1", name: "Swift 7GB", price: 3000, data: "7GB", validity: "30 Days" },
    { id: "swift-2", name: "Swift 15GB", price: 5500, data: "15GB", validity: "30 Days" },
    { id: "swift-3", name: "Swift 30GB", price: 9000, data: "30GB", validity: "30 Days" },
    { id: "swift-4", name: "Swift Unlimited", price: 16000, data: "Unlimited", validity: "30 Days" },
  ],
  ntel: [
    { id: "ntel-1", name: "ntel 5GB", price: 2500, data: "5GB", validity: "30 Days" },
    { id: "ntel-2", name: "ntel 10GB", price: 4500, data: "10GB", validity: "30 Days" },
    { id: "ntel-3", name: "ntel 20GB", price: 7000, data: "20GB", validity: "30 Days" },
    { id: "ntel-4", name: "ntel Unlimited", price: 12000, data: "Unlimited", validity: "30 Days" },
  ],
};

const Internet = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading: paystackLoading } = usePaystack();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { isVerifying, customerInfo, verificationError, verifyAccount, resetVerification } = useInternetVerification();

  const isLoading = paystackLoading || walletLoading;

  const [provider, setProvider] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<InternetPlan | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const [isAccountVerified, setIsAccountVerified] = useState(false);

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.endsWith("@eagles.local");
  const emailSuggestion = getEmailSuggestion(paymentEmail);

  // Debounced account verification
  const debouncedVerify = useDebouncedCallback(
    async (number: string, prov: string) => {
      if (number.length >= 5 && prov) {
        const isValid = await verifyAccount(number, prov);
        setIsAccountVerified(isValid);
      }
    },
    800
  );

  // Trigger verification when account number or provider changes
  useEffect(() => {
    if (accountNumber && provider) {
      setIsAccountVerified(false);
      debouncedVerify(accountNumber, provider);
    } else {
      resetVerification();
      setIsAccountVerified(false);
    }
  }, [accountNumber, provider]);

  // Reset plan when provider changes
  useEffect(() => {
    setSelectedPlan(null);
  }, [provider]);

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

    if (!selectedPlan || !accountNumber || !provider) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (!isAccountVerified) {
      toast({
        title: "Account Not Verified",
        description: "Please wait for account verification before proceeding",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      transaction_type: "internet" as const,
      internet_plan: selectedPlan.name,
      account_number: accountNumber,
      provider,
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: selectedPlan.price,
        metadata,
      });
      if (success) {
        setSelectedPlan(null);
        setAccountNumber("");
        setProvider("");
        resetVerification();
        setIsAccountVerified(false);
      }
    } else {
      const validEmail = hasSyntheticEmail()
        ? isValidEmail(paymentEmail) ? paymentEmail : null
        : isValidEmail(user.email || "") ? user.email : null;

      if (!validEmail) {
        toast({
          title: "Email Required",
          description: hasSyntheticEmail()
            ? "Please enter a valid email address for payments."
            : "Please update your profile with a valid email address.",
          variant: "destructive",
        });
        return;
      }

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

  const currentPlans = provider ? plansByProvider[provider] || [] : [];

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
                Internet <span className="text-gradient-gold">Subscription</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-lg">
        <Card className="shadow-card border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              Internet Subscription
            </CardTitle>
            <CardDescription>
              Subscribe to Smile, Spectranet, iPNX, Swift 4G, ntel & more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <Label>Internet Provider</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {internetProviders.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Number */}
              <div className="space-y-3">
                <Label htmlFor="account">
                  {provider === "smile" ? "Email / Account ID" : provider === "ipnx" ? "Customer ID" : "Account / Device Number"}
                </Label>
                <div className="relative">
                  <Input
                    id="account"
                    type="text"
                    placeholder={provider === "smile" ? "Enter Smile email or account ID" : "Enter account number"}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className={`h-12 pr-10 ${
                      isAccountVerified
                        ? "border-green-500"
                        : verificationError
                        ? "border-destructive"
                        : ""
                    }`}
                    disabled={!provider}
                  />
                  {isVerifying && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {!isVerifying && isAccountVerified && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {!isVerifying && verificationError && (
                    <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                  )}
                </div>

                {/* Verification Result */}
                {isVerifying && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Verifying account...
                  </div>
                )}
                {customerInfo && (
                  <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
                      <User className="h-4 w-4" />
                      {customerInfo.customer_name}
                    </div>
                  </div>
                )}
                {verificationError && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {verificationError}
                    </p>
                  </div>
                )}
              </div>

              {/* Plan Selection */}
              {provider && (
                <div className="space-y-3">
                  <Label>Select Plan</Label>
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
                        <div className="text-xs text-muted-foreground">
                          {plan.data} • {plan.validity}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {user && hasSyntheticEmail() && paymentMethod === "paystack" && (
                <div className="space-y-2">
                  <Label htmlFor="internet-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email for Payment Receipt
                  </Label>
                  <Input
                    id="internet-email"
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
                </div>
              )}

              {user && (
                <PaymentMethodSelector
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                  walletBalance={walletBalance}
                  amount={selectedPlan?.price || 0}
                />
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || !selectedPlan || !isAccountVerified}
              >
                {isLoading
                  ? "Processing..."
                  : !isAccountVerified
                  ? "Verify Account First"
                  : selectedPlan
                  ? paymentMethod === "wallet"
                    ? `Pay ₦${selectedPlan.price.toLocaleString()} from Wallet`
                    : `Pay ₦${selectedPlan.price.toLocaleString()}`
                  : "Select a Plan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Internet;
