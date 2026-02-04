import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Globe, Check, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useWalletPayment } from "@/hooks/useWalletPayment";
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

const internetPlans: InternetPlan[] = [
  { id: "smile-1", name: "Smile 1.5GB", price: 1000, data: "1.5GB", validity: "30 Days" },
  { id: "smile-2", name: "Smile 3GB", price: 1500, data: "3GB", validity: "30 Days" },
  { id: "smile-3", name: "Smile 6.5GB", price: 2500, data: "6.5GB", validity: "30 Days" },
  { id: "smile-4", name: "Smile 10GB", price: 3500, data: "10GB", validity: "30 Days" },
  { id: "spectranet-1", name: "Spectranet 7GB", price: 3000, data: "7GB", validity: "30 Days" },
  { id: "spectranet-2", name: "Spectranet 15GB", price: 5000, data: "15GB", validity: "30 Days" },
  { id: "spectranet-3", name: "Spectranet 30GB", price: 8000, data: "30GB", validity: "30 Days" },
  { id: "spectranet-4", name: "Spectranet Unlimited", price: 15000, data: "Unlimited", validity: "30 Days" },
];

const Internet = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading: paystackLoading } = usePaystack();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();

  const isLoading = paystackLoading || walletLoading;

  const [selectedPlan, setSelectedPlan] = useState<InternetPlan | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.endsWith("@eagles.local");
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

    if (!selectedPlan || !accountNumber) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      transaction_type: "internet" as const,
      internet_plan: selectedPlan.name,
      account_number: accountNumber,
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: selectedPlan.price,
        metadata,
      });
      if (success) {
        setSelectedPlan(null);
        setAccountNumber("");
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
              Subscribe to Smile, Spectranet, and other ISPs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Account Number */}
              <div className="space-y-3">
                <Label htmlFor="account">Account / Device Number</Label>
                <Input
                  id="account"
                  type="text"
                  placeholder="Enter account number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="h-12"
                />
              </div>

              {/* Plan Selection */}
              <div className="space-y-3">
                <Label>Select Plan</Label>
                <div className="grid grid-cols-2 gap-3">
                  {internetPlans.map((plan) => (
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
      </main>
    </div>
  );
};

export default Internet;