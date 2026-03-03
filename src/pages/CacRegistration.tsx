import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Wallet,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Copy,
  FileText,
  Users,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

type RegType = "business-name" | "limited-company" | "incorporated-trustee";

const regOptions: { value: RegType; label: string; price: number; description: string; icon: string }[] = [
  { value: "business-name", label: "Business Name (BN)", price: 40000, description: "For sole proprietors and partnerships", icon: "📋" },
  { value: "limited-company", label: "Limited Company (LTD)", price: 75000, description: "For private/public limited companies", icon: "🏢" },
  { value: "incorporated-trustee", label: "Incorporated Trustee (IT)", price: 80000, description: "For NGOs, churches, clubs, associations", icon: "🏛️" },
];

interface CacRequest {
  id: string;
  regType: RegType;
  business_name?: string;
  status: string;
  rc_number?: string;
  created_at: string;
  api_response: any;
}

const CacRegistration = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("register");
  const [regType, setRegType] = useState<RegType | "">("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  // Form fields
  const [proposedName1, setProposedName1] = useState("");
  const [proposedName2, setProposedName2] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessActivity, setBusinessActivity] = useState("");
  const [proprietorName, setProprietorName] = useState("");
  const [proprietorPhone, setProprietorPhone] = useState("");
  const [proprietorEmail, setProprietorEmail] = useState("");
  const [proprietorNin, setProprietorNin] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  // Previous requests
  const [previousRequests, setPreviousRequests] = useState<CacRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) loadPreviousRequests();
  }, [user]);

  const selectedReg = regOptions.find((r) => r.value === regType);
  const price = selectedReg?.price || 0;

  const loadPreviousRequests = async () => {
    if (!user) return;
    setIsLoadingRequests(true);
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .like("data_plan", "cac-%")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        setPreviousRequests(data.map((t: any) => ({
          id: t.id,
          regType: t.data_plan?.replace("cac-", "") as RegType,
          business_name: (t.api_response as any)?.proposed_name_1,
          status: t.status,
          rc_number: (t.api_response as any)?.rc_number,
          created_at: t.created_at,
          api_response: t.api_response,
        })));
      }
    } catch {} finally {
      setIsLoadingRequests(false);
    }
  };

  const handleSubmit = async () => {
    if (!regType) { toast({ title: "Select Type", description: "Please select a registration type", variant: "destructive" }); return; }
    if (!consent) { toast({ title: "Consent Required", variant: "destructive" }); return; }
    if (!proposedName1.trim()) { toast({ title: "Name Required", description: "Enter at least one proposed business name", variant: "destructive" }); return; }
    if (!proprietorName.trim()) { toast({ title: "Required", description: "Enter proprietor/director name", variant: "destructive" }); return; }
    if (!proprietorPhone.trim()) { toast({ title: "Required", description: "Enter phone number", variant: "destructive" }); return; }

    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < price) {
      toast({ title: "Insufficient Balance", description: `You need ₦${price.toLocaleString()} but have ₦${walletBalance.toLocaleString()}.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("paystack-payment", {
        body: { action: "wallet_payment", amount: price, metadata: { transaction_type: "verification", phone_number: proprietorPhone } },
      });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) { toast({ title: "Payment Failed", description: paymentData?.error || "Failed to debit wallet.", variant: "destructive" }); setIsSubmitting(false); return; }

      const apiResponse = {
        type: regType,
        proposed_name_1: proposedName1,
        proposed_name_2: proposedName2,
        business_address: businessAddress,
        business_activity: businessActivity,
        proprietor_name: proprietorName,
        proprietor_phone: proprietorPhone,
        proprietor_email: proprietorEmail,
        proprietor_nin: proprietorNin,
        additional_info: additionalInfo,
      };

      await supabase.from("transactions").insert({
        user_id: user!.id,
        transaction_type: "verification" as any,
        amount: price,
        status: "processing" as any,
        data_plan: `cac-${regType}`,
        api_response: apiResponse,
        phone_number: proprietorPhone,
        balance_before: paymentData.balance_before,
        balance_after: paymentData.balance_after,
        description: `CAC ${selectedReg?.label} Registration`,
      });

      await refreshProfile();
      await loadPreviousRequests();
      toast({ title: "Request Submitted!", description: "Your CAC registration request has been submitted. Processing takes 3-7 business days." });

      setRegType("");
      setConsent(false);
      setProposedName1(""); setProposedName2(""); setBusinessAddress(""); setBusinessActivity("");
      setProprietorName(""); setProprietorPhone(""); setProprietorEmail(""); setProprietorNin("");
      setAdditionalInfo("");
      setActiveTab("retrieve");
    } catch (err: any) {
      try { await supabase.functions.invoke("paystack-payment", { body: { action: "credit_wallet", amount: price } }); await refreshProfile(); } catch {}
      toast({ title: "Error", description: err.message || "Something went wrong. Wallet refunded.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!" }); };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Completed</Badge>;
      case "processing": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Processing</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = searchQuery.trim()
    ? previousRequests.filter((r) => {
        const q = searchQuery.toLowerCase();
        return r.business_name?.toLowerCase().includes(q) || r.rc_number?.toLowerCase().includes(q);
      })
    : previousRequests;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse-soft text-primary">Loading...</div></div>;
  if (!user) return null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Top bar */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-primary text-primary-foreground">
          <div className="container flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/verification")} className="text-primary-foreground hover:bg-primary-foreground/10">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                <span className="text-base font-bold tracking-tight">Corporate Affairs Commission</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-3 py-1.5">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Sub navigation */}
        <div className="w-full bg-primary/90 text-primary-foreground border-b border-primary-foreground/10">
          <div className="container flex items-center gap-1 h-10 text-xs">
            <button
              onClick={() => setActiveTab("register")}
              className={`px-4 py-2 rounded-t-md font-medium transition-colors ${activeTab === "register" ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}
            >
              Register
            </button>
            <button
              onClick={() => setActiveTab("retrieve")}
              className={`px-4 py-2 rounded-t-md font-medium transition-colors ${activeTab === "retrieve" ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}
            >
              Track Status
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-6rem)]">
          {/* Left hero panel */}
          <div className="hidden lg:flex lg:w-[45%] gradient-hero text-primary-foreground relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
            <div className="relative z-10 flex flex-col justify-center p-12 space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-1.5 text-xs font-medium backdrop-blur-sm">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Official Registration Service
                </div>
                <h2 className="text-3xl font-bold leading-tight">
                  Business Registration<br />Made Simple
                </h2>
                <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-md">
                  Register your business with the Corporate Affairs Commission (CAC) directly from this platform. Fast, secure, and hassle-free.
                </p>
              </div>

              <div className="space-y-4">
                {regOptions.map((opt) => (
                  <div key={opt.value} className="flex items-center gap-4 bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/10">
                    <span className="text-2xl">{opt.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{opt.label}</p>
                      <p className="text-xs text-primary-foreground/60">{opt.description}</p>
                    </div>
                    <span className="text-sm font-bold">₦{opt.price.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/10">
                <Clock className="h-5 w-5 flex-shrink-0 mt-0.5 text-secondary" />
                <div className="text-xs text-primary-foreground/70">
                  <p className="font-semibold text-primary-foreground text-sm">Processing: 3-7 business days</p>
                  <p className="mt-1">Track your registration status and receive your RC number upon completion.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 lg:w-[55%]">
            {/* Mobile hero banner */}
            <div className="lg:hidden gradient-hero text-primary-foreground p-6 space-y-3">
              <h2 className="text-xl font-bold">Business Registration Made Simple</h2>
              <p className="text-xs text-primary-foreground/70">Register your business with CAC. Processing takes 3-7 business days.</p>
              <div className="flex flex-wrap gap-2">
                {regOptions.map((opt) => (
                  <span key={opt.value} className="text-[10px] bg-primary-foreground/10 rounded-full px-3 py-1 font-medium">
                    {opt.label} — ₦{opt.price.toLocaleString()}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
              {/* Info alert */}
              <div className="bg-accent border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-accent-foreground">How it works</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Select registration type, fill in your details, and submit. Your wallet will be charged immediately. Track status under "Track Status" tab.</p>
                </div>
              </div>

              {activeTab === "register" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">New Registration</h3>
                    <p className="text-xs text-muted-foreground">Fill out the form below to begin your CAC registration</p>
                  </div>

                  {/* Registration type cards */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Select Registration Type</Label>
                    <div className="grid gap-3">
                      {regOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setRegType(opt.value)}
                          className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                            regType === opt.value
                              ? "border-primary bg-accent shadow-sm"
                              : "border-border hover:border-primary/40 bg-card"
                          }`}
                        >
                          <span className="text-2xl">{opt.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">₦{opt.price.toLocaleString()}</p>
                          </div>
                          {regType === opt.value && (
                            <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {regType && (
                    <div className="space-y-5 animate-fade-in">
                      {/* Business details */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                          <Building2 className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Business Details</h4>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Proposed Business Name 1 <span className="text-destructive">*</span></Label>
                            <Input placeholder="Enter preferred business name" value={proposedName1} onChange={(e) => setProposedName1(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Proposed Business Name 2 (Alternative)</Label>
                            <Input placeholder="Enter alternative name" value={proposedName2} onChange={(e) => setProposedName2(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Business Address</Label>
                            <Input placeholder="Registered business address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Nature of Business</Label>
                            <Input placeholder="e.g. General merchandise, IT services" value={businessActivity} onChange={(e) => setBusinessActivity(e.target.value)} className="h-11" />
                          </div>
                        </div>
                      </div>

                      {/* Proprietor details */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                          <Users className="h-4 w-4 text-primary" />
                          <h4 className="text-sm font-bold text-foreground">Proprietor / Director Details</h4>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">Full Name <span className="text-destructive">*</span></Label>
                            <Input placeholder="Full legal name" value={proprietorName} onChange={(e) => setProprietorName(e.target.value)} className="h-11" />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Phone <span className="text-destructive">*</span></Label>
                              <Input type="tel" placeholder="08012345678" value={proprietorPhone} onChange={(e) => setProprietorPhone(e.target.value)} maxLength={15} className="h-11" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Email</Label>
                              <Input type="email" placeholder="email@example.com" value={proprietorEmail} onChange={(e) => setProprietorEmail(e.target.value)} className="h-11" />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-medium">NIN (11 digits)</Label>
                            <Input placeholder="Enter NIN" value={proprietorNin} onChange={(e) => setProprietorNin(e.target.value.replace(/\D/g, ""))} maxLength={11} className="h-11" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Additional Information</Label>
                        <Textarea placeholder="Any additional details or special requests..." value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={3} />
                      </div>

                      {/* Consent & Submit */}
                      <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                        <div className="flex items-start gap-2">
                          <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                          <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                            I confirm that the information provided is accurate and I authorize this CAC registration.
                          </Label>
                        </div>

                        <Button className="w-full h-12 text-base font-bold" onClick={handleSubmit} disabled={isSubmitting}>
                          {isSubmitting ? (
                            <><Clock className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                          ) : (
                            <>Submit Registration <ChevronRight className="h-4 w-4 ml-1" /> — ₦{price.toLocaleString()}</>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "retrieve" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Track Registration</h3>
                    <p className="text-xs text-muted-foreground">View and track your CAC registration requests</p>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by business name or RC number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-11" />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{filteredRequests.length} request(s)</p>
                    <Button variant="ghost" size="sm" onClick={loadPreviousRequests} disabled={isLoadingRequests}>
                      <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingRequests ? "animate-spin" : ""}`} />Refresh
                    </Button>
                  </div>

                  {filteredRequests.length === 0 ? (
                    <Card>
                      <CardContent className="p-8 text-center text-muted-foreground">
                        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm font-medium">{searchQuery ? "No matching requests" : "No CAC requests yet"}</p>
                        {!searchQuery && (
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("register")}>
                            <FileText className="h-3.5 w-3.5 mr-1" />Register Now
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {filteredRequests.map((req) => (
                        <Card key={req.id} className={req.status === "completed" ? "border-emerald-500/30" : ""}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm font-semibold">{regOptions.find(r => r.value === req.regType)?.label || req.regType}</span>
                              </div>
                              {getStatusBadge(req.status)}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {req.business_name && <p>Name: <span className="text-foreground">{req.business_name}</span></p>}
                              <p>Submitted: <span className="text-foreground">{new Date(req.created_at).toLocaleDateString()}</span></p>
                            </div>
                            {req.status === "completed" && req.rc_number && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-emerald-600 font-medium">RC Number</p>
                                    <p className="text-lg font-bold font-mono text-emerald-700">{req.rc_number}</p>
                                  </div>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(req.rc_number!)}>
                                    <Copy className="h-4 w-4 text-emerald-600" />
                                  </Button>
                                </div>
                              </div>
                            )}
                            {req.status === "processing" && (
                              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
                                <p className="text-xs text-amber-600">Processing... Check back in 3-7 business days.</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border p-4 text-center text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} The Eagles Charge • CAC Registration Service
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default CacRegistration;
