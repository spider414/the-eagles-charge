import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Wifi, Check, Loader2, Mail, AlertCircle, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import NetworkSelector, { NetworkType } from "./NetworkSelector";
import PaymentMethodSelector, { PaymentMethod } from "./PaymentMethodSelector";
import FavoriteNumbersSelector from "./FavoriteNumbersSelector";
import { useToast } from "@/hooks/use-toast";
import { usePaystackPopup } from "@/hooks/usePaystackPopup";
import { useWalletPayment } from "@/hooks/useWalletPayment";
import { useFavoriteNumbers } from "@/hooks/useFavoriteNumbers";
import { useAuth } from "@/contexts/AuthContext";
import { detectNetwork } from "@/utils/phoneUtils";
import { useDataPlans, DataPlan } from "@/hooks/useDataPlans";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import { supabase } from "@/integrations/supabase/client";

// Categorize plans by validity period
type PlanCategory = "hot" | "daily" | "weekly" | "monthly";
type PlanType = "sme" | "gifting" | "corporate" | "direct";

const categorizePlan = (validity: string): Exclude<PlanCategory, "hot"> => {
  const lower = validity.toLowerCase();
  if (lower.includes("1 day") || lower.includes("2 day") || lower.includes("1day") || lower.includes("2day")) {
    return "daily";
  }
  if (lower.includes("7 day") || lower.includes("14 day") || lower.includes("7day") || lower.includes("14day")) {
    return "weekly";
  }
  return "monthly";
};

// Determine plan type from name or price patterns
const getPlanType = (plan: DataPlan): PlanType => {
  const name = plan.name.toLowerCase();
  if (name.includes("sme") || name.includes("corporate")) return "sme";
  if (name.includes("gift") || name.includes("share")) return "gifting";
  if (name.includes("corp")) return "corporate";
  // Default: cheaper plans are typically SME, more expensive are direct/gifting
  return plan.price < 500 ? "sme" : "direct";
};

// Hot/Popular plans - best value plans that are commonly purchased
const HOT_PLAN_IDS = [
  // MTN popular plans
  "46", "48", "50", "27", "60",
  // Glo popular plans  
  "36", "40", "37", "38",
  // Airtel popular plans
  "17", "18", "52",
  // 9mobile popular plans
  "71", "73", "74",
];

const isHotPlan = (planId: string): boolean => HOT_PLAN_IDS.includes(planId);

interface DataPlanSelectorProps {
  plans: DataPlan[];
  selectedPlan: DataPlan | null;
  onSelectPlan: (plan: DataPlan) => void;
  isLoading: boolean;
}

const DataPlanSelector = ({ plans, selectedPlan, onSelectPlan, isLoading }: DataPlanSelectorProps) => {
  const [activeTab, setActiveTab] = useState<PlanCategory>("hot");

  // Group plans by category
  const categorizedPlans = useMemo(() => {
    const grouped: Record<PlanCategory, DataPlan[]> = {
      hot: [],
      daily: [],
      weekly: [],
      monthly: [],
    };

    plans.forEach((plan) => {
      // Add to hot category if it's a popular plan
      if (isHotPlan(plan.id)) {
        grouped.hot.push(plan);
      }
      // Also add to time-based category
      const category = categorizePlan(plan.validity);
      grouped[category].push(plan);
    });

    // Sort each category by price
    Object.keys(grouped).forEach((key) => {
      grouped[key as PlanCategory].sort((a, b) => a.price - b.price);
    });

    return grouped;
  }, [plans]);

  // Get count for each tab
  const tabCounts = useMemo(() => ({
    hot: categorizedPlans.hot.length,
    daily: categorizedPlans.daily.length,
    weekly: categorizedPlans.weekly.length,
    monthly: categorizedPlans.monthly.length,
  }), [categorizedPlans]);

  // Auto-select hot tab if it has plans, otherwise first available
  useEffect(() => {
    if (tabCounts.hot > 0) {
      setActiveTab("hot");
    } else if (tabCounts.daily > 0) {
      setActiveTab("daily");
    } else if (tabCounts.weekly > 0) {
      setActiveTab("weekly");
    } else if (tabCounts.monthly > 0) {
      setActiveTab("monthly");
    }
  }, [tabCounts]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading plans...</span>
      </div>
    );
  }

  const getPlanTypeBadge = (plan: DataPlan) => {
    const type = getPlanType(plan);
    switch (type) {
      case "sme":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">SME</Badge>;
      case "gifting":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">Gifting</Badge>;
      case "corporate":
        return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Corp</Badge>;
      default:
        return null;
    }
  };

  const renderPlanCards = (planList: DataPlan[], showHotBadge = false) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {planList.map((plan) => (
        <button
          key={plan.id}
          type="button"
          onClick={() => onSelectPlan(plan)}
          className={`relative p-3 rounded-xl border-2 text-center transition-all ${
            selectedPlan?.id === plan.id
              ? "border-primary bg-accent shadow-card"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          }`}
        >
          {selectedPlan?.id === plan.id && (
            <Check className="absolute top-2 right-2 h-4 w-4 text-primary" />
          )}
          {showHotBadge && isHotPlan(plan.id) && (
            <Flame className="absolute top-2 left-2 h-4 w-4 text-orange-500" />
          )}
          <div className="flex items-center justify-center gap-1 mb-1">
            <span className="text-base font-bold text-foreground">{plan.size}</span>
            {getPlanTypeBadge(plan)}
          </div>
          <div className="text-xs text-muted-foreground mb-1">{plan.validity}</div>
          <div className="text-lg font-extrabold text-primary">
            ₦{plan.price.toLocaleString()}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 animate-fade-in">
      <Label>Select Data Plan</Label>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PlanCategory)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 mb-4">
          <TabsTrigger value="hot" disabled={tabCounts.hot === 0} className="text-xs sm:text-sm gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            Hot
          </TabsTrigger>
          <TabsTrigger value="daily" disabled={tabCounts.daily === 0} className="text-xs sm:text-sm">
            Daily
          </TabsTrigger>
          <TabsTrigger value="weekly" disabled={tabCounts.weekly === 0} className="text-xs sm:text-sm">
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly" disabled={tabCounts.monthly === 0} className="text-xs sm:text-sm">
            Monthly
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hot" className="mt-0">
          {categorizedPlans.hot.length > 0 ? (
            renderPlanCards(categorizedPlans.hot, true)
          ) : (
            <p className="text-center text-muted-foreground py-4">No hot plans available</p>
          )}
        </TabsContent>

        <TabsContent value="daily" className="mt-0">
          {categorizedPlans.daily.length > 0 ? (
            renderPlanCards(categorizedPlans.daily)
          ) : (
            <p className="text-center text-muted-foreground py-4">No daily plans available</p>
          )}
        </TabsContent>

        <TabsContent value="weekly" className="mt-0">
          {categorizedPlans.weekly.length > 0 ? (
            renderPlanCards(categorizedPlans.weekly)
          ) : (
            <p className="text-center text-muted-foreground py-4">No weekly plans available</p>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="mt-0">
          {categorizedPlans.monthly.length > 0 ? (
            renderPlanCards(categorizedPlans.monthly)
          ) : (
            <p className="text-center text-muted-foreground py-4">No monthly plans available</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

const DataForm = () => {
  const navigate = useNavigate();
  const [network, setNetwork] = useState<NetworkType | null>(null);
  const [phone, setPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("paystack");
  const [paymentEmail, setPaymentEmail] = useState("");
  const { toast } = useToast();
  const { user, profile, refreshProfile } = useAuth();
  const { initializePayment, isLoading: paystackLoading } = usePaystackPopup();
  const { payWithWallet, isLoading: walletLoading, walletBalance } = useWalletPayment();
  const { addFavorite } = useFavoriteNumbers();

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.endsWith("@eagles.local");

  // Get email suggestion for typos
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
  const { plans: currentPlans, isLoading: plansLoading, fetchPlans } = useDataPlans();

  const isLoading = paystackLoading || walletLoading;

  // Fetch plans when network changes
  useEffect(() => {
    if (network) {
      fetchPlans(network);
      setSelectedPlan(null);
    }
  }, [network, fetchPlans]);

  // Auto-detect network when phone number changes
  useEffect(() => {
    if (phone.length >= 4) {
      const detected = detectNetwork(phone);
      if (detected && detected !== network) {
        setNetwork(detected);
      }
    }
  }, [phone, network]);

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    setPhone(cleaned);
  };

  const handleFavoriteSelect = (selectedPhone: string, selectedNetwork: NetworkType) => {
    setPhone(selectedPhone);
    setNetwork(selectedNetwork);
    setSelectedPlan(null);
  };

  const handleSaveNumber = async () => {
    if (phone.length === 11 && network) {
      await addFavorite(phone, network);
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

    if (!selectedPlan) {
      toast({
        title: "Select a plan",
        description: "Please select a data plan",
        variant: "destructive",
      });
      return;
    }

    const metadata = {
      transaction_type: "data" as const,
      phone_number: phone,
      network: network,
      data_plan: selectedPlan.variation_id, // Send variation_id for CheapDataHub API
      data_plan_name: selectedPlan.size, // Keep display name for records
    };

    if (paymentMethod === "wallet") {
      const success = await payWithWallet({
        amount: selectedPlan.price,
        metadata,
      });
      if (success) {
        setPhone("");
        setSelectedPlan(null);
        setNetwork(null);
      }
    } else {
      // Get valid email for card payment
      const validEmail = hasSyntheticEmail() 
        ? (isValidEmail(paymentEmail) ? paymentEmail : null)
        : (isValidEmail(user.email || "") ? user.email : null);

      if (!validEmail) {
        toast({
          title: "Email Required",
          description: hasSyntheticEmail()
            ? "Please enter a valid email address for card payments."
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
    <Card className="shadow-card border-2 border-border hover:border-primary/20 transition-colors">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5 text-primary" />
          Buy Data Bundle
        </CardTitle>
        <CardDescription>
          Affordable data plans for all Nigerian networks
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <Label>Select Network</Label>
            <NetworkSelector
              selected={network}
              onSelect={(n) => {
                setNetwork(n);
                setSelectedPlan(null);
              }}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="data-phone">Phone Number</Label>
            <Input
              id="data-phone"
              type="tel"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="h-12"
            />
            <FavoriteNumbersSelector
              onSelect={handleFavoriteSelect}
              currentPhone={phone}
              currentNetwork={network}
              onSaveCurrentNumber={handleSaveNumber}
              canSave={true}
            />
          </div>

          {network && (
            <DataPlanSelector
              plans={currentPlans}
              selectedPlan={selectedPlan}
              onSelectPlan={setSelectedPlan}
              isLoading={plansLoading}
            />
          )}

          {user && selectedPlan && hasSyntheticEmail() && paymentMethod === "paystack" && (
            <div className="space-y-2">
              <Label htmlFor="data-email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email for Payment Receipt
              </Label>
              <Input
                id="data-email"
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
              <p className="text-xs text-muted-foreground">
                Required for card payments. Will be saved to your profile.
              </p>
            </div>
          )}

          {user && selectedPlan && (
            <PaymentMethodSelector
              selected={paymentMethod}
              onSelect={setPaymentMethod}
              walletBalance={walletBalance}
              amount={selectedPlan.price}
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
  );
};

export default DataForm;
