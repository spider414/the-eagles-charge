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

const regOptions: { value: RegType; label: string; price: number; description: string }[] = [
  { value: "business-name", label: "Business Name (BN)", price: 40000, description: "For sole proprietors and partnerships" },
  { value: "limited-company", label: "Limited Company (LTD)", price: 75000, description: "For private/public limited companies" },
  { value: "incorporated-trustee", label: "Incorporated Trustee (IT)", price: 80000, description: "For NGOs, churches, clubs, associations" },
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
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/verification")}><ArrowLeft className="h-5 w-5" /></Button>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold shadow-gold"><Building2 className="h-5 w-5 text-secondary-foreground" /></div>
                <span className="text-lg font-bold text-foreground">CAC Registration</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
            </div>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-6 max-w-lg mx-auto">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">CAC Registration</h1>
            <p className="text-sm text-muted-foreground">Register your business with the Corporate Affairs Commission</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700">Processing takes 3-7 business days</p>
              <p className="text-amber-600/80 text-xs mt-0.5">After submission, check the "Status" tab to track your registration and get your RC number.</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Register</TabsTrigger>
              <TabsTrigger value="retrieve" className="gap-1.5"><Search className="h-3.5 w-3.5" />Status</TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="space-y-5 mt-4">
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-base">Select Registration Type</CardTitle></CardHeader>
                <CardContent>
                  <Select value={regType} onValueChange={(v) => setRegType(v as RegType)}>
                    <SelectTrigger><SelectValue placeholder="-- Select registration type --" /></SelectTrigger>
                    <SelectContent>
                      {regOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">{opt.label} - ₦{opt.price.toLocaleString()}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedReg && (
                    <p className="text-xs text-muted-foreground mt-2">{selectedReg.description}</p>
                  )}
                </CardContent>
              </Card>

              {regType && (
                <Card className="animate-fade-in">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Business Details</CardTitle>
                    <CardDescription className="text-xs">All fields marked * are required</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Proposed Business Name 1 *</Label>
                      <Input placeholder="Enter preferred business name" value={proposedName1} onChange={(e) => setProposedName1(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Proposed Business Name 2 (Alternative)</Label>
                      <Input placeholder="Enter alternative name" value={proposedName2} onChange={(e) => setProposedName2(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Business Address</Label>
                      <Input placeholder="Registered business address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nature of Business</Label>
                      <Input placeholder="e.g. General merchandise, IT services" value={businessActivity} onChange={(e) => setBusinessActivity(e.target.value)} />
                    </div>

                    <div className="pt-2 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-3">Proprietor / Director Details</p>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Full Name *</Label>
                          <Input placeholder="Full legal name" value={proprietorName} onChange={(e) => setProprietorName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label>Phone *</Label>
                            <Input type="tel" placeholder="08012345678" value={proprietorPhone} onChange={(e) => setProprietorPhone(e.target.value)} maxLength={15} />
                          </div>
                          <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" placeholder="email@example.com" value={proprietorEmail} onChange={(e) => setProprietorEmail(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>NIN (11 digits)</Label>
                          <Input placeholder="Enter NIN" value={proprietorNin} onChange={(e) => setProprietorNin(e.target.value.replace(/\D/g, ""))} maxLength={11} />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Additional Information</Label>
                      <Textarea placeholder="Any additional details or special requests..." value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={3} />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <p><strong>Note:</strong> CAC registration processing takes 3-7 business days. You'll receive your RC number once completed.</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                      <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">I confirm that the information provided is accurate and I authorize this CAC registration.</Label>
                    </div>

                    <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? <><Clock className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <><Building2 className="h-4 w-4 mr-2" />Submit - ₦{price.toLocaleString()}</>}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="retrieve" className="space-y-4 mt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by business name or RC number..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filteredRequests.length} request(s)</p>
                <Button variant="ghost" size="sm" onClick={loadPreviousRequests} disabled={isLoadingRequests}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingRequests ? "animate-spin" : ""}`} />Refresh
                </Button>
              </div>
              {filteredRequests.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground">
                  <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">{searchQuery ? "No matching requests" : "No CAC requests yet"}</p>
                  {!searchQuery && <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("register")}><FileText className="h-3.5 w-3.5 mr-1" />Register Now</Button>}
                </CardContent></Card>
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
                              <div><p className="text-xs text-emerald-600 font-medium">RC Number</p><p className="text-lg font-bold font-mono text-emerald-700">{req.rc_number}</p></div>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(req.rc_number!)}><Copy className="h-4 w-4 text-emerald-600" /></Button>
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
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </PageTransition>
  );
};

export default CacRegistration;
