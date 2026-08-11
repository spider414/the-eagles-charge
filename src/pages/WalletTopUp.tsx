import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Wallet, CreditCard, Building2, Copy, Check, Loader2, ShieldCheck, Mail, AlertCircle, Clock, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import BrandLogo from "@/components/BrandLogo";

const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000];

type PaymentMethod = "card" | "bank_transfer" | null;

interface DVADetails {
  account_number: string;
  account_name: string;
  bank_name: string;
}

const WalletTopUp = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { initializePayment, isLoading: isPaymentLoading } = usePaystackPopup();
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [dvaDetails, setDvaDetails] = useState<DVADetails | null>(null);
  const [isLoadingDVA, setIsLoadingDVA] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  
  // BVN verification form
  const [showBVNForm, setShowBVNForm] = useState(false);
  const [bvn, setBvn] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [isCreatingDVA, setIsCreatingDVA] = useState(false);
  const [dvaPending, setDvaPending] = useState(false);
  
  // Email for card payments (for phone-based accounts)
  const [paymentEmail, setPaymentEmail] = useState("");
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Fetch DVA on mount
  useEffect(() => {
    if (user) {
      fetchDVA();
    }
  }, [user]);

  // Auto-poll for DVA when verification is pending
  useEffect(() => {
    if (!dvaPending || dvaDetails) return;

    const pollInterval = setInterval(() => {
      console.log("Polling for DVA status...");
      fetchDVA();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollInterval);
  }, [dvaPending, dvaDetails]);

  // Pre-fill form with profile data
  useEffect(() => {
    if (profile) {
      const nameParts = (profile.full_name || "").split(" ");
      setFirstName(nameParts[0] || "");
      setLastName(nameParts.slice(1).join(" ") || "");
      setPhone(profile.phone_number || "");
      
      // Pre-fill payment email if profile has a valid non-synthetic email
      const profileEmail = profile.email || "";
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(profileEmail) && !profileEmail.match(/@(eagles\.local|phone\.harmicglobal\.com)$/)) {
        setPaymentEmail(profileEmail);
      }
    }
  }, [profile]);

  const fetchDVA = async () => {
    setIsLoadingDVA(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("paystack-payment", {
        body: { action: "get_dva" },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.data?.success && response.data?.data) {
        setDvaDetails(response.data.data);
        setDvaPending(false); // Stop polling
        // Silently pull in any transfers whose webhook was missed
        reconcileTransfers(true);
        toast({ title: "Account Ready!", description: "Your virtual account is now active" });
      } else if (response.data?.pending) {
        setDvaPending(true);
      }
    } catch (error) {
      console.error("Error fetching DVA:", error);
    } finally {
      setIsLoadingDVA(false);
    }
  };

  // Re-check Paystack for transfers that were not credited (missed webhooks)
  const reconcileTransfers = async (silent = false) => {
    setIsReconciling(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("paystack-payment", {
        body: { action: "reconcile_dva" },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      });
      if (error) throw error;

      if (data?.credited > 0) {
        await refreshProfile();
        toast({
          title: "Wallet Credited",
          description: `₦${Number(data.amount).toLocaleString()} from ${data.credited} transfer(s) added to your wallet`,
        });
      } else if (!silent) {
        toast({
          title: "No New Transfers",
          description: "We couldn't find any uncredited transfers. Please try again in a moment.",
        });
      }
    } catch (err) {
      console.error("Reconcile error:", err);
      if (!silent) {
        toast({
          title: "Check Failed",
          description: "Could not verify your transfers. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsReconciling(false);
    }
  };

  // Generate a valid email for DVA creation (for phone-based users)
  const getDVAEmail = (): string => {
    // If user has a real email, use it
    const userEmail = user?.email || "";
    if (!userEmail.match(/@(eagles\.local|phone\.harmicglobal\.com)$/) && isValidEmail(userEmail)) {
      return userEmail;
    }
    // If profile has a valid payment email, use it
    const profileEmail = profile?.email || "";
    if (!profileEmail.match(/@(eagles\.local|phone\.harmicglobal\.com)$/) && isValidEmail(profileEmail)) {
      return profileEmail;
    }
    // Generate a unique email using the user's phone number or ID
    const phone = profile?.phone_number?.replace(/\D/g, "") || "";
    if (phone) {
      return `user${phone}@eagles-vtu.com`;
    }
    // Fallback to user ID based email
    return `user${user?.id?.substring(0, 8)}@eagles-vtu.com`;
  };

  const createDVA = async () => {
    if (!user || !bvn || !firstName || !lastName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (bvn.length !== 11) {
      toast({
        title: "Invalid BVN",
        description: "BVN must be exactly 11 digits",
        variant: "destructive",
      });
      return;
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (!/^0\d{10}$/.test(phoneDigits)) {
      toast({
        title: "Invalid Phone Number",
        description: "Enter the 11-digit phone number linked to your BVN (e.g. 08012345678)",
        variant: "destructive",
      });
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z' -]{1,}$/.test(firstName.trim()) || !/^[a-zA-Z][a-zA-Z' -]{1,}$/.test(lastName.trim())) {
      toast({
        title: "Check Your Names",
        description: "Enter your first and last name exactly as registered on your BVN",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingDVA(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const dvaEmail = getDVAEmail();
      
      console.log("Creating DVA with email:", dvaEmail);
      
      const response = await supabase.functions.invoke("paystack-payment", {
        body: {
          action: "create_dva",
          email: dvaEmail,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phoneDigits,
          bvn: bvn,
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const data = response.data;
      if (!data.success && !data.pending) {
        throw new Error(data.error || "Failed to create virtual account");
      }

      if (data.pending) {
        setDvaPending(true);
        setShowBVNForm(false);
        toast({
          title: "Verification in Progress",
          description: "Your BVN is being verified. Your account will be ready shortly.",
        });
      } else if (data.data) {
        setDvaDetails(data.data);
        setShowBVNForm(false);
        await refreshProfile();
        toast({
          title: "Account Created!",
          description: "Your virtual account is ready for transfers",
        });
      }
    } catch (error) {
      console.error("DVA creation error:", error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Failed to verify BVN",
        variant: "destructive",
      });
    } finally {
      setIsCreatingDVA(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleCopyAccountNumber = async () => {
    if (dvaDetails?.account_number) {
      await navigator.clipboard.writeText(dvaDetails.account_number);
      setCopied(true);
      toast({ title: "Copied!", description: "Account number copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => {
    const email = user?.email || "";
    return email.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);
  };

  // Get email suggestion for typos
  const emailSuggestion = getEmailSuggestion(paymentEmail);

  // Get valid payment email (from user account or manual input)
  const getValidPaymentEmail = () => {
    // If user has synthetic email, use manual input
    if (hasSyntheticEmail()) {
      return isValidEmail(paymentEmail) ? paymentEmail : null;
    }
    // Otherwise use account email
    const email = user?.email || "";
    return isValidEmail(email) ? email : null;
  };

  // Save payment email to profile
  const savePaymentEmail = async (email: string) => {
    if (!profile) return;
    
    setIsSavingEmail(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ email })
        .eq("user_id", user?.id);
      
      if (error) {
        console.error("Failed to save email:", error);
      } else {
        await refreshProfile();
      }
    } catch (err) {
      console.error("Error saving email:", err);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const handleCardPayment = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      toast({ title: "Invalid amount", description: "Minimum amount is ₦100", variant: "destructive" });
      return;
    }

    const validEmail = getValidPaymentEmail();
    if (!validEmail) {
      toast({ 
        title: "Email Required", 
        description: hasSyntheticEmail() 
          ? "Please enter a valid email address for card payments."
          : "Please update your profile with a valid email address.", 
        variant: "destructive" 
      });
      return;
    }

    // Save the payment email to profile if it's different from the stored one
    if (hasSyntheticEmail() && validEmail !== profile?.email) {
      await savePaymentEmail(validEmail);
    }

    setPaymentMethod("card");
    await initializePayment({
      amount: numAmount,
      email: validEmail,
      metadata: {
        transaction_type: "wallet_topup",
      },
      onSuccess: (reference) => {
        console.log("Payment completed:", reference);
        setAmount("");
        setPaymentMethod(null);
      },
      onClose: () => {
        setPaymentMethod(null);
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BrandLogo className="h-8 w-8" rounded="rounded-lg" />
            <span className="font-semibold">Fund Wallet</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-6">
        {/* Current Balance */}
        <Card className="gradient-hero text-primary-foreground">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wallet className="h-6 w-6" />
              <span className="text-sm text-primary-foreground/80">Current Balance</span>
            </div>
            <p className="text-3xl font-bold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</p>
          </CardContent>
        </Card>

        {/* Virtual Account Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Bank Transfer
            </CardTitle>
            <CardDescription>
              {dvaDetails 
                ? "Transfer any amount from your bank app to the account below"
                : "Get a dedicated account number and fund your wallet by bank transfer"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingDVA ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dvaDetails ? (
              <div className="space-y-3 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Bank Name</span>
                  <span className="font-medium">{dvaDetails.bank_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Account Number</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">{dvaDetails.account_number}</span>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleCopyAccountNumber}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-muted-foreground">Account Name</span>
                  <span className="font-medium text-sm">{dvaDetails.account_name}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Payment Reference</span>
                  <span className="font-mono text-sm">{dvaDetails.account_number}</span>
                </div>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" />
                  Estimated credit time: 1–5 minutes (up to 15 minutes at peak hours)
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-green-500" />
                  No narration needed — your account number is the reference. Paystack settles automatically.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => reconcileTransfers(false)}
                  disabled={isReconciling}
                >
                  {isReconciling ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Checking transfers...
                    </>
                  ) : (
                    "I've sent money — refresh balance"
                  )}
                </Button>
              </div>
            ) : dvaPending ? (
              <div className="text-center py-6 space-y-4">
                <div className="flex items-center justify-center gap-2 text-yellow-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="font-medium">Verification in Progress</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your BVN is being verified. This usually takes a few minutes.
                </p>
                <Button variant="outline" onClick={fetchDVA}>
                  Check Status
                </Button>
              </div>
            ) : showBVNForm ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-blue-500/10 rounded-lg text-sm text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                  <span>Your BVN is securely processed by Paystack and never stored on our servers.</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="As on BVN"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="As on BVN"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="08012345678"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bvn">BVN (Bank Verification Number) *</Label>
                  <Input
                    id="bvn"
                    type="text"
                    inputMode="numeric"
                    value={bvn}
                    onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    placeholder="11-digit BVN"
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dial *565*0# to get your BVN
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowBVNForm(false)}>
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={createDVA}
                    disabled={isCreatingDVA || !bvn || !firstName || !lastName}
                  >
                    {isCreatingDVA ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium mb-1">Get Your Dedicated Account</p>
                  <p className="text-sm text-muted-foreground">
                    Create a unique bank account number, then transfer from any Nigerian bank.
                    Funds land in your wallet in about 1–5 minutes.
                  </p>
                </div>
                <Button onClick={() => setShowBVNForm(true)}>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Verify with BVN
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Top-up Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Top-up</CardTitle>
            <CardDescription>Pay with card or USSD for instant funding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (₦)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₦</span>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-lg font-semibold h-14"
                  min={100}
                />
              </div>
              <p className="text-xs text-muted-foreground">Minimum amount: ₦100</p>
            </div>

            {/* Email Input for phone-based accounts */}
            {hasSyntheticEmail() && (
              <div className="space-y-2">
                <Label htmlFor="paymentEmail" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email for Payment Receipt
                </Label>
                <Input
                  id="paymentEmail"
                  type="email"
                  placeholder="your@email.com"
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
                  Enter a valid email to receive your payment receipt
                </p>
              </div>
            )}

            {/* Quick Amount Buttons */}
            <div className="grid grid-cols-3 gap-2">
              {quickAmounts.map((quickAmount) => (
                <Button
                  key={quickAmount}
                  variant={amount === quickAmount.toString() ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleQuickAmount(quickAmount)}
                  className="h-10"
                >
                  ₦{quickAmount.toLocaleString()}
                </Button>
              ))}
            </div>

            {/* Pay Button */}
            <Button
              className="w-full h-12 text-lg font-semibold gradient-gold text-secondary-foreground"
              onClick={handleCardPayment}
              disabled={isPaymentLoading || !amount || parseFloat(amount) < 100}
            >
              {isPaymentLoading ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Pay ₦{amount ? parseFloat(amount).toLocaleString() : "0"}
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Secured by Paystack. Your payment information is encrypted.
            </p>
          </CardContent>
        </Card>

        {/* Referral bonus eligibility */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Referral bonus
            </CardTitle>
            <CardDescription>How the ₦1,000 referrer reward is triggered</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>• If you signed up with a referral code, your <span className="text-foreground font-medium">first</span> completed wallet funding pays your referrer ₦1,000.</p>
            <p>• The ₦2,000 welcome bonus does <span className="text-foreground font-medium">not</span> count — it is excluded from eligibility.</p>
            <p>• Card payments and bank transfers both qualify; the reward is paid once per referred user.</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default WalletTopUp;