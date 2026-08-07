import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Tv, Check, Mail, AlertCircle, Loader2, User, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useSmartcardVerification } from "@/hooks/useSmartcardVerification";
import PaymentMethodSelector, { PaymentMethod } from "@/components/PaymentMethodSelector";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

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
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading: paystackLoading } = usePaystackPopup();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { isVerifying, customerInfo, verificationError, verifySmartcard, resetVerification } = useSmartcardVerification();

  const isLoading = paystackLoading || walletLoading;

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<CablePlan | null>(null);
  const [smartcardNumber, setSmartcardNumber] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const [isSmartcardVerified, setIsSmartcardVerified] = useState(false);
  
  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);
  const emailSuggestion = getEmailSuggestion(paymentEmail);

  // Debounced smartcard verification
  const debouncedVerify = useDebouncedCallback(
    async (number: string, provider: string) => {
      if (number.length >= 10 && provider) {
        const isValid = await verifySmartcard(number, provider as "dstv" | "gotv" | "startimes");
        setIsSmartcardVerified(isValid);
      }
    },
    800
  );

  // Trigger verification when smartcard number or provider changes
  useEffect(() => {
    if (smartcardNumber.length >= 10 && selectedProvider) {
      debouncedVerify(smartcardNumber, selectedProvider);
    } else {
      resetVerification();
      setIsSmartcardVerified(false);
    }
  }, [smartcardNumber, selectedProvider, debouncedVerify, resetVerification]);

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

    if (!selectedProvider || !selectedPlan || !smartcardNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Verify smartcard before payment
    if (!isSmartcardVerified) {
      toast({
        title: "Invalid Smartcard",
        description: verificationError || "Please enter a valid smartcard number before proceeding.",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      transaction_type: "cable_tv" as const,
      cable_provider: selectedPlan.provider,
      cable_smartcard: smartcardNumber,
      cable_plan: selectedPlan.name,
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: selectedPlan.price,
        metadata,
      });
      if (success) {
        setSelectedProvider(null);
        setSelectedPlan(null);
        setSmartcardNumber("");
        setIsSmartcardVerified(false);
        resetVerification();
      }
    } else {
      // Get valid email for payment
      const validEmail = hasSyntheticEmail() 
        ? (isValidEmail(paymentEmail) ? paymentEmail : null)
        : (isValidEmail(user.email || "") ? user.email : null);

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
                <div className="relative">
                  <Input
                    id="smartcard"
                    type="text"
                    placeholder="Enter smartcard number"
                    value={smartcardNumber}
                    onChange={(e) => {
                      setSmartcardNumber(e.target.value.replace(/\D/g, ""));
                      setIsSmartcardVerified(false);
                    }}
                    className={`h-12 pr-10 ${
                      smartcardNumber.length >= 10
                        ? isVerifying
                          ? "border-muted"
                          : isSmartcardVerified
                          ? "border-green-500"
                          : verificationError
                          ? "border-destructive"
                          : ""
                        : ""
                    }`}
                  />
                  {smartcardNumber.length >= 10 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isVerifying ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : isSmartcardVerified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : verificationError ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Verification Status */}
                {smartcardNumber.length >= 10 && !isVerifying && (
                  <>
                    {verificationError && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                        <XCircle className="h-4 w-4 text-destructive shrink-0" />
                        <p className="text-sm text-destructive">{verificationError}</p>
                      </div>
                    )}
                    {customerInfo && (
                      <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 space-y-2 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-foreground">
                            {customerInfo.customer_name}
                          </span>
                        </div>
                        {customerInfo.current_package && (
                          <div className="flex items-center gap-2">
                            <Tv className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              Current: {customerInfo.current_package}
                            </span>
                          </div>
                        )}
                        {customerInfo.due_date && (
                          <p className="text-xs text-muted-foreground">
                            Due: {customerInfo.due_date}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {!selectedProvider && smartcardNumber.length >= 10 && (
                  <p className="text-xs text-muted-foreground">
                    Please select a provider to verify your smartcard
                  </p>
                )}
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

              {user && hasSyntheticEmail() && paymentMethod === "paystack" && (
                <div className="space-y-2">
                  <Label htmlFor="cable-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email for Payment Receipt
                  </Label>
                  <Input
                    id="cable-email"
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

              <Button type="submit" size="lg" className="w-full" disabled={isLoading || !selectedPlan}>
                {isLoading
                  ? "Processing..."
                  : selectedPlan
                  ? paymentMethod === "wallet"
                    ? `Pay ₦${selectedPlan.price.toLocaleString()} from Wallet`
                    : `Pay ₦${selectedPlan.price.toLocaleString()}`
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
