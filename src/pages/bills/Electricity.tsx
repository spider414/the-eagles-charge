import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Zap, Mail, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePaystack } from "@/hooks/usePaystack";
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
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { initializePayment, isLoading } = usePaystack();

  const [disco, setDisco] = useState("");
  const [meterType, setMeterType] = useState<"prepaid" | "postpaid">("prepaid");
  const [meterNumber, setMeterNumber] = useState("");
  const [amount, setAmount] = useState("");

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

    await initializePayment({
      amount: Number(amount),
      email: user.email || "",
      metadata: {
        transaction_type: "electricity",
        electricity_provider: disco,
        meter_number: meterNumber,
        meter_type: meterType,
      },
    });
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
                <Select value={disco} onValueChange={setDisco}>
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
                  onValueChange={(val) => setMeterType(val as "prepaid" | "postpaid")}
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
                <Input
                  id="meter-number"
                  type="text"
                  placeholder="Enter meter number"
                  value={meterNumber}
                  onChange={(e) => setMeterNumber(e.target.value.replace(/\D/g, ""))}
                  className="h-12"
                />
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

              <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                {isLoading ? "Processing..." : `Pay ₦${Number(amount || 0).toLocaleString()}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Electricity;
