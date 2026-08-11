import { useState, useEffect } from "react";
import { chargeTotal } from "@/lib/pricing";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Globe, Check, Mail, AlertCircle, Loader2, User, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useInternetVerification } from "@/hooks/useInternetVerification";
import { useInternetPlans, InternetPlan } from "@/hooks/useInternetPlans";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import PaymentMethodSelector, { PaymentMethod } from "@/components/PaymentMethodSelector";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

const internetProviders = [
  { id: "smile", name: "Smile" },
  { id: "spectranet", name: "Spectranet" },
  { id: "ipnx", name: "iPNX" },
  { id: "swift", name: "Swift 4G" },
  { id: "ntel", name: "ntel" },
];

const Internet = () => {
  const navigate = useNavigate();
  const { t, formatCurrency } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading: paystackLoading } = usePaystackPopup();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { isVerifying, customerInfo, verificationError, verifyAccount, resetVerification } = useInternetVerification();
  const { plans: currentPlans, isLoading: plansLoading, fetchPlans } = useInternetPlans();

  const isLoading = paystackLoading || walletLoading;

  const [provider, setProvider] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<InternetPlan | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const [isAccountVerified, setIsAccountVerified] = useState(false);

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);
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

  // Fetch plans when provider changes
  useEffect(() => {
    setSelectedPlan(null);
    if (provider) {
      fetchPlans(provider);
    }
  }, [provider, fetchPlans]);

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
              <BrandLogo className="h-10 w-10" rounded="rounded-xl" />
              <span className="text-xl font-bold text-foreground">
                <span className="text-gradient-gold">{t("net.header")}</span>
              </span>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container py-8 max-w-lg">
        <Card className="shadow-card border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {t("net.header")}
            </CardTitle>
            <CardDescription>
              {t("net.desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Provider Selection */}
              <div className="space-y-3">
                <Label>{t("net.provider")}</Label>
                <Select value={provider} onValueChange={setProvider}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={t("net.selectProvider")} />
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
                    placeholder={provider === "smile" ? "Enter Smile email or account ID" : provider === "ipnx" ? "Enter iPNX customer ID" : "Enter account number"}
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
                    {t("net.verifying")}
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
                  <Label className="flex items-center gap-2">
                    {t("net.selectPlan")}
                    {plansLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </Label>
                  {plansLoading ? (
                    <div className="flex items-center justify-center py-8 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                      {t("net.loadingPlans")}
                    </div>
                  ) : currentPlans.length > 0 ? (
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
                            {formatCurrency(plan.price)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {plan.data} • {plan.validity}
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      {t("net.noPlans")}
                    </div>
                  )}
                </div>
              )}

              {user && hasSyntheticEmail() && paymentMethod === "paystack" && (
                <div className="space-y-2">
                  <Label htmlFor="internet-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {t("wallet.emailReceipt")}
                  </Label>
                  <Input
                    id="internet-email"
                    type="email"
                    placeholder={t("wallet.emailReceipt")}
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
                      {t("wallet.didYouMean")} {emailSuggestion}?
                    </button>
                  )}
                  {paymentEmail && !isValidEmail(paymentEmail) && !emailSuggestion && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {t("wallet.emailInvalid")}
                    </p>
                  )}
                </div>
              )}

              {user && (
                <PaymentMethodSelector
                  selected={paymentMethod}
                  onSelect={setPaymentMethod}
                  walletBalance={walletBalance}
                  amount={chargeTotal("internet", selectedPlan?.price || 0)}
                />
              )}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || !selectedPlan || !isAccountVerified}
              >
                {isLoading
                  ? t("wallet.processing")
                  : !isAccountVerified
                  ? t("net.verifyFirst")
                  : selectedPlan
                  ? paymentMethod === "wallet"
                    ? `${t("wallet.pay")} ${formatCurrency(chargeTotal("internet", selectedPlan.price))} ${t("pay.fromWallet")}`
                    : `${t("wallet.pay")} ${formatCurrency(chargeTotal("internet", selectedPlan.price))}`
                  : t("net.selectPlanCta")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Internet;
