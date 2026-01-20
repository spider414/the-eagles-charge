import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Bird, ArrowLeft, Wallet, CreditCard, Building2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { usePaystack } from "@/hooks/usePaystack";

const quickAmounts = [500, 1000, 2000, 5000, 10000, 20000];

const WalletTopUp = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const { initializePayment, isLoading: isPaymentLoading } = usePaystack();
  const [amount, setAmount] = useState<string>("");

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

  const handleTopUp = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 100) {
      return;
    }

    await initializePayment({
      amount: numAmount,
      email: user.email!,
      metadata: {
        transaction_type: "wallet_topup" as any, // wallet topup will be handled as a special case
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
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <Bird className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="font-semibold">Fund Wallet</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto">
        {/* Current Balance */}
        <Card className="mb-6 gradient-hero text-primary-foreground">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Wallet className="h-6 w-6" />
              <span className="text-sm text-primary-foreground/80">Current Balance</span>
            </div>
            <p className="text-3xl font-bold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</p>
          </CardContent>
        </Card>

        {/* Top-up Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Enter Amount</CardTitle>
            <CardDescription>Minimum amount is ₦100</CardDescription>
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

            {/* Payment Methods Info */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground font-medium">Payment Methods</p>
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span>Card</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Bank Transfer</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg text-sm">
                  <Smartphone className="h-4 w-4 text-primary" />
                  <span>USSD</span>
                </div>
              </div>
            </div>

            {/* Fund Button */}
            <Button
              onClick={handleTopUp}
              disabled={isPaymentLoading || !amount || parseFloat(amount) < 100}
              className="w-full h-12 text-lg font-semibold gradient-gold text-secondary-foreground hover:opacity-90"
            >
              {isPaymentLoading ? (
                <span className="animate-pulse">Processing...</span>
              ) : (
                <>
                  <Wallet className="h-5 w-5 mr-2" />
                  Fund Wallet
                </>
              )}
            </Button>

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
