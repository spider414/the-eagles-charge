import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Wallet } from "lucide-react";
import NetworkSelector, { NetworkType } from "./NetworkSelector";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
import { useAuth } from "@/contexts/AuthContext";

const quickAmounts = [100, 200, 500, 1000, 2000, 5000];

const AirtimeForm = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { initializePayment, isLoading } = usePaystack();

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

    await initializePayment({
      amount: Number(amount),
      email: user.email || "",
      metadata: {
        transaction_type: "airtime",
        phone_number: phone,
        network: network,
      },
    });
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
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
              className="h-12"
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

          <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
            {isLoading ? "Processing..." : `Pay ₦${Number(amount || 0).toLocaleString()}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AirtimeForm;
