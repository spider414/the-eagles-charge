import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Wallet,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Copy,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

interface ScumlRequest {
  id: string;
  business_name?: string;
  status: string;
  certificate_number?: string;
  created_at: string;
  api_response: any;
}

const PRICE = 15000;

const ScumlRegistration = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("register");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessActivity, setBusinessActivity] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [previousRequests, setPreviousRequests] = useState<ScumlRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { if (!isLoading && !user) navigate("/auth"); }, [user, isLoading, navigate]);
  useEffect(() => { if (user) loadPreviousRequests(); }, [user]);

  const loadPreviousRequests = async () => {
    if (!user) return;
    setIsLoadingRequests(true);
    try {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).like("data_plan", "scuml%").order("created_at", { ascending: false }).limit(20);
      if (data) {
        setPreviousRequests(data.map((t: any) => ({
          id: t.id, business_name: (t.api_response as any)?.business_name, status: t.status,
          certificate_number: (t.api_response as any)?.certificate_number, created_at: t.created_at, api_response: t.api_response,
        })));
      }
    } catch {} finally { setIsLoadingRequests(false); }
  };

  const handleSubmit = async () => {
    if (!consent) { toast({ title: "Consent Required", variant: "destructive" }); return; }
    if (!businessName.trim()) { toast({ title: "Required", description: "Enter business name", variant: "destructive" }); return; }
    if (!contactName.trim()) { toast({ title: "Required", description: "Enter contact person name", variant: "destructive" }); return; }
    if (!contactPhone.trim()) { toast({ title: "Required", description: "Enter phone number", variant: "destructive" }); return; }

    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < PRICE) {
      toast({ title: "Insufficient Balance", description: `You need ₦${PRICE.toLocaleString()} but have ₦${walletBalance.toLocaleString()}.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("paystack-payment", {
        body: { action: "wallet_payment", amount: PRICE, metadata: { transaction_type: "verification", phone_number: contactPhone } },
      });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) { toast({ title: "Payment Failed", description: paymentData?.error, variant: "destructive" }); setIsSubmitting(false); return; }

      await supabase.from("transactions").insert({
        user_id: user!.id, transaction_type: "verification" as any, amount: PRICE, status: "processing" as any, data_plan: "scuml-registration",
        api_response: { business_name: businessName, rc_number: rcNumber, business_address: businessAddress, business_activity: businessActivity, contact_name: contactName, contact_phone: contactPhone, contact_email: contactEmail, additional_info: additionalInfo },
        phone_number: contactPhone, balance_before: paymentData.balance_before, balance_after: paymentData.balance_after, description: "SCUML Registration",
      });

      await refreshProfile();
      await loadPreviousRequests();
      toast({ title: "Request Submitted!", description: "Your SCUML registration has been submitted. Processing takes 5-10 business days." });
      setBusinessName(""); setRcNumber(""); setBusinessAddress(""); setBusinessActivity(""); setContactName(""); setContactPhone(""); setContactEmail(""); setAdditionalInfo(""); setConsent(false);
      setActiveTab("retrieve");
    } catch (err: any) {
      try { await supabase.functions.invoke("paystack-payment", { body: { action: "credit_wallet", amount: PRICE } }); await refreshProfile(); } catch {}
      toast({ title: "Error", description: err.message || "Something went wrong. Wallet refunded.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const copyText = (t: string) => { navigator.clipboard.writeText(t); toast({ title: "Copied!" }); };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Completed</Badge>;
      case "processing": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Processing</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };
  const filteredRequests = searchQuery.trim()
    ? previousRequests.filter((r) => r.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.certificate_number?.toLowerCase().includes(searchQuery.toLowerCase()))
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold shadow-gold"><FileText className="h-5 w-5 text-secondary-foreground" /></div>
                <span className="text-lg font-bold text-foreground">SCUML</span>
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
            <h1 className="text-2xl font-bold text-foreground">SCUML Registration</h1>
            <p className="text-sm text-muted-foreground">Special Control Unit against Money Laundering certificate</p>
          </div>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700">Processing takes 5-10 business days</p>
              <p className="text-amber-600/80 text-xs mt-0.5">Your SCUML certificate number will be available in the "Status" tab once completed.</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Register</TabsTrigger>
              <TabsTrigger value="retrieve" className="gap-1.5"><Search className="h-3.5 w-3.5" />Status</TabsTrigger>
            </TabsList>

            <TabsContent value="register" className="space-y-5 mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" />Business Information</CardTitle>
                  <CardDescription className="text-xs">Provide your business details for SCUML registration • ₦{PRICE.toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Business Name *</Label><Input placeholder="Registered business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></div>
                  <div className="space-y-2"><Label>RC/BN Number</Label><Input placeholder="CAC registration number" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Business Address</Label><Input placeholder="Registered address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Nature of Business</Label><Input placeholder="e.g. Financial services, Real estate" value={businessActivity} onChange={(e) => setBusinessActivity(e.target.value)} /></div>

                  <div className="pt-2 border-t border-border">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">Contact Person</p>
                    <div className="space-y-3">
                      <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="Contact person name" value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2"><Label>Phone *</Label><Input type="tel" placeholder="08012345678" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={15} /></div>
                        <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="email@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2"><Label>Additional Information</Label><Textarea placeholder="Any additional details..." value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={3} /></div>

                  <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                    <p><strong>SCUML</strong> is mandatory for Designated Non-Financial Businesses and Professions (DNFBPs) as required by CBN/NFIU.</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                    <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">I confirm the information is accurate and authorize this SCUML registration.</Label>
                  </div>

                  <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <><Clock className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <><FileText className="h-4 w-4 mr-2" />Submit - ₦{PRICE.toLocaleString()}</>}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="retrieve" className="space-y-4 mt-4">
              <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by business name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" /></div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{filteredRequests.length} request(s)</p>
                <Button variant="ghost" size="sm" onClick={loadPreviousRequests} disabled={isLoadingRequests}><RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingRequests ? "animate-spin" : ""}`} />Refresh</Button>
              </div>
              {filteredRequests.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-muted-foreground"><AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm font-medium">{searchQuery ? "No matching requests" : "No SCUML requests yet"}</p>{!searchQuery && <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("register")}><FileText className="h-3.5 w-3.5 mr-1" />Register Now</Button>}</CardContent></Card>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((req) => (
                    <Card key={req.id} className={req.status === "completed" ? "border-emerald-500/30" : ""}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between"><span className="text-sm font-semibold">{req.business_name || "SCUML Request"}</span>{getStatusBadge(req.status)}</div>
                        <p className="text-xs text-muted-foreground">Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
                        {req.status === "completed" && req.certificate_number && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-emerald-600 font-medium">SCUML Certificate No.</p><p className="text-lg font-bold font-mono text-emerald-700">{req.certificate_number}</p></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(req.certificate_number!)}><Copy className="h-4 w-4 text-emerald-600" /></Button></div></div>
                        )}
                        {req.status === "processing" && <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600 animate-pulse" /><p className="text-xs text-amber-600">Processing... Check back in 5-10 business days.</p></div>}
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

export default ScumlRegistration;
