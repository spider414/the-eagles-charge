import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Wallet, CreditCard, Building2, Copy, Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePaystack } from "@/hooks/usePaystack";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
  const { initializePayment, isLoading: isPaymentLoading } = usePaystack();
  const { toast } = useToast();
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(null);
  const [dvaDetails, setDvaDetails] = useState<DVADetails | null>(null);
  const [isLoadingDVA, setIsLoadingDVA] = useState(false);
  const [isCreatingDVA, setIsCreatingDVA] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);

  // Fetch DVA on mount
  useEffect(() => {
    if (user) {
      fetchDVA();
    }
  }, [user]);

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
      }
    } catch (error) {
      console.error("Error fetching DVA:", error);
    } finally {
      setIsLoadingDVA(false);
    }
  };

  const createDVA = async () => {
    if (!user || !profile) return;

    setIsCreatingDVA(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      // Parse name from profile or email
      const fullName = profile.full_name || user.email?.split("@")[0] || "User";
      const nameParts = fullName.split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : firstName;

      const response = await supabase.functions.invoke("paystack-payment", {
        body: {
          action: "create_dva",
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          phone: profile.phone_number || "",
        },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      
      const data = response.data;
      if (!data.success) throw new Error(data.error || "Failed to create virtual account");

      setDvaDetails(data.data);
      await refreshProfile();
      
      toast({
        title: "Virtual Account Created!",
        description: "Your unique bank account is ready for transfers",
      });
    } catch (error) {
      console.error("DVA creation error:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create virtual account",
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

  const handleCardPayment = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      toast({ title: "Invalid amount", description: "Minimum amount is ₦100", variant: "destructive" });
      return;
    }

    setPaymentMethod("card");
    await initializePayment({
      amount: numAmount,
      email: user.email!,
      metadata: {
        transaction_type: "wallet_topup" as any,
      },
    });
  };

  const handleBankTransfer = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      toast({ title: "Invalid amount", description: "Minimum amount is ₦100", variant: "destructive" });
      return;
    }
    
    if (!dvaDetails) {
      toast({ 
        title: "No Virtual Account", 
        description: "Please create a virtual account first",
        variant: "destructive" 
      });
      return;
    }

    setPaymentMethod("bank_transfer");
    setShowBankDetails(true);
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <Bird className="h-5 w-5 text-secondary-foreground" />
            </div>
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

        {/* Dedicated Virtual Account Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Your Bank Account
            </CardTitle>
            <CardDescription>
              Transfer to this account anytime to fund your wallet automatically
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
                <p className="text-xs text-muted-foreground mt-2">
                  💡 Any transfer to this account will automatically credit your wallet
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Create a unique bank account number for easy wallet funding
                </p>
                <Button onClick={createDVA} disabled={isCreatingDVA}>
                  {isCreatingDVA ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create Virtual Account
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Top-up Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Top-up</CardTitle>
            <CardDescription>Pay with card for instant funding</CardDescription>
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
            </div>

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

            {/* Payment Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className={cn(
                  "h-16 flex-col gap-1",
                  paymentMethod === "card" && "ring-2 ring-primary"
                )}
                onClick={handleCardPayment}
                disabled={isPaymentLoading || !amount || parseFloat(amount) < 100}
              >
                {isPaymentLoading && paymentMethod === "card" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <CreditCard className="h-5 w-5 text-primary" />
                )}
                <span className="text-xs">Card / USSD</span>
              </Button>
              <Button
                variant="outline"
                className={cn(
                  "h-16 flex-col gap-1",
                  paymentMethod === "bank_transfer" && "ring-2 ring-primary"
                )}
                onClick={handleBankTransfer}
                disabled={!dvaDetails || !amount || parseFloat(amount) < 100}
              >
                <Building2 className="h-5 w-5 text-primary" />
                <span className="text-xs">Bank Transfer</span>
              </Button>
            </div>

            {/* Show bank details when bank transfer selected */}
            {showBankDetails && dvaDetails && (
              <div className="space-y-3 p-4 bg-muted rounded-lg border animate-in fade-in">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Transfer ₦{parseFloat(amount).toLocaleString()}</h3>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowBankDetails(false)}
                  >
                    Close
                  </Button>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span className="font-medium">{dvaDetails.bank_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Account</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold">{dvaDetails.account_number}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCopyAccountNumber}>
                        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium text-xs">{dvaDetails.account_name}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground bg-yellow-500/10 p-2 rounded">
                  ⚠️ Transfer <strong>exactly ₦{parseFloat(amount).toLocaleString()}</strong> to this account. Your wallet will be credited automatically.
                </p>
              </div>
            )}

            <p className="text-xs text-center text-muted-foreground">
              Secured by Paystack. Your payment information is encrypted.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default WalletTopUp;