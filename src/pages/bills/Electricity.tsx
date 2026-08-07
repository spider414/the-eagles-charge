import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Zap, Mail, AlertCircle, Loader2, User, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useMeterVerification } from "@/hooks/useMeterVerification";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import PaymentMethodSelector, { PaymentMethod } from "@/components/PaymentMethodSelector";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";

const discos = [
  { id: "ekedc", name: "Eko Electricity (EKEDC)" },
  { id: "ikedc", name: "Ikeja Electricity (IKEDC)" },
  { id: "aedc", name: "Abuja Electricity (AEDC)" },
  { id: "phedc", name: "Port Harcourt Electricity (PHEDC)" },
  { id: "kedco", name: "Kano Electricity (KEDCO)" },
  { id: "ibedc", name: "Ibadan Electricity (IBEDC)" },
  { id: "eedc", name: "Enugu Electricity (EEDC)" },
  { id: "bedc", name: "Benin Electricity (BEDC)" },
  { id: "jedc", name: "Jos Electricity (JEDC)" },
  { id: "kaedco", name: "Kaduna Electricity (KAEDCO)" },
  { id: "yedc", name: "Yola Electricity (YEDC)" },
];

const Electricity = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading: paystackLoading } = usePaystackPopup();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { isVerifying, customerInfo, verificationError, verifyMeter, resetVerification } = useMeterVerification();

  const isLoading = paystackLoading || walletLoading;

  const [disco, setDisco] = useState("");
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [meterNumber, setMeterNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentEmail, setPaymentEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const [isMeterVerified, setIsMeterVerified] = useState(false);

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);
  const emailSuggestion = getEmailSuggestion(paymentEmail);

  // Debounced meter verification
  const debouncedVerify = useDebouncedCallback(
    async (number: string, provider: string, type: "prepaid" | "postpaid") => {
      if (number.length >= 10 && provider) {
        const isValid = await verifyMeter(number, provider, type);
        setIsMeterVerified(isValid);
      }
    },
    800
  );

  // Trigger verification when meter number, disco, or type changes
  useEffect(() => {
    if (meterNumber.length >= 10 && disco) {
      debouncedVerify(meterNumber, disco, meterType);
    } else {
      resetVerification();
      setIsMeterVerified(false);
    }
  }, [meterNumber, disco, meterType, debouncedVerify, resetVerification]);

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

    if (!disco || !meterNumber || !amount) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (Number(amount) < 500) {
      toast({
        title: "Minimum Amount",
        description: "Minimum electricity purchase is ₦500",
        variant: "destructive",
      });
      return;
    }

    // Verify meter before payment
    if (!isMeterVerified) {
      toast({
        title: "Invalid Meter",
        description: verificationError || "Please enter a valid meter number before proceeding.",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      transaction_type: "electricity" as const,
      electricity_provider: disco,
      meter_number: meterNumber,
      meter_type: meterType,
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: Number(amount),
        metadata,
      });
      if (success) {
        setDisco("");
        setMeterNumber("");
        setAmount("");
        setIsMeterVerified(false);
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
        amount: Number(amount),
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
                Electricity <span className="text-gradient-gold">Bills</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-8 max-w-lg">
        <Card className="shadow-card border-2 border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Buy Electricity
            </CardTitle>
            <CardDescription>
              Pay for prepaid or postpaid electricity bills
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <Label>Distribution Company (DisCo)</Label>
                <Select value={disco} onValueChange={(val) => {
                  setDisco(val);
                  setIsMeterVerified(false);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select your DisCo" />
                  </SelectTrigger>
                  <SelectContent>
                    {discos.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Meter Type</Label>
                <RadioGroup
                  value={meterType}
                  onValueChange={(val) => {
                    setMeterType(val as "prepaid" | "postpaid");
                    setIsMeterVerified(false);
                  }}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="prepaid" id="prepaid" />
                    <Label htmlFor="prepaid" className="cursor-pointer">Prepaid</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="postpaid" id="postpaid" />
                    <Label htmlFor="postpaid" className="cursor-pointer">Postpaid</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label htmlFor="meter-number">Meter Number</Label>
                <div className="relative">
                  <Input
                    id="meter-number"
                    type="text"
                    placeholder="Enter meter number"
                    value={meterNumber}
                    onChange={(e) => {
                      setMeterNumber(e.target.value.replace(/\D/g, ""));
                      setIsMeterVerified(false);
                    }}
                    className={`h-12 pr-10 ${
                      meterNumber.length >= 10
                        ? isVerifying
                          ? "border-muted"
                          : isMeterVerified
                          ? "border-green-500"
                          : verificationError
                          ? "border-destructive"
                          : ""
                        : ""
                    }`}
                  />
                  {meterNumber.length >= 10 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {isVerifying ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : isMeterVerified ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : verificationError ? (
                        <XCircle className="h-5 w-5 text-destructive" />
                      ) : null}
                    </div>
                  )}
                </div>

                {/* Verification Status */}
                {meterNumber.length >= 10 && !isVerifying && (
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
                        {customerInfo.customer_address && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {customerInfo.customer_address}
                            </span>
                          </div>
                        )}
                        {customerInfo.outstanding_balance && (
                          <p className="text-xs text-muted-foreground">
                            Outstanding: ₦{customerInfo.outstanding_balance}
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {!disco && meterNumber.length >= 10 && (
                  <p className="text-xs text-muted-foreground">
                    Please select a DisCo to verify your meter
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="amount">Amount (₦)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Minimum ₦500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12"
                  min={500}
                />
              </div>

              {user && hasSyntheticEmail() && paymentMethod === "paystack" && (
                <div className="space-y-2">
                  <Label htmlFor="electricity-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email for Payment Receipt
                  </Label>
                  <Input
                    id="electricity-email"
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
      </main>
    </div>
  );
};

export default Electricity;
