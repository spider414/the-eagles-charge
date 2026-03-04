import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  Wallet,
  Clock,
  AlertCircle,
  RefreshCw,
  Search,
  Copy,
  FileText,
  Building2,
  Info,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

interface IpeRequest {
  id: string;
  business_name?: string;
  status: string;
  clearance_number?: string;
  created_at: string;
  api_response: any;
}

const PRICE = 20000;

const IpeClearance = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("register");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [tinNumber, setTinNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [purposeOfClearance, setPurposeOfClearance] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");

  const [previousRequests, setPreviousRequests] = useState<IpeRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { if (!isLoading && !user) navigate("/auth"); }, [user, isLoading, navigate]);
  useEffect(() => { if (user) loadPreviousRequests(); }, [user]);

  const loadPreviousRequests = async () => {
    if (!user) return;
    setIsLoadingRequests(true);
    try {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).like("data_plan", "ipe%").order("created_at", { ascending: false }).limit(20);
      if (data) {
        setPreviousRequests(data.map((t: any) => ({ id: t.id, business_name: (t.api_response as any)?.business_name, status: t.status, clearance_number: (t.api_response as any)?.clearance_number, created_at: t.created_at, api_response: t.api_response })));
      }
    } catch {} finally { setIsLoadingRequests(false); }
  };

  const handleSubmit = async () => {
    if (!consent) { toast({ title: "Consent Required", variant: "destructive" }); return; }
    if (!businessName.trim()) { toast({ title: "Required", description: "Enter business/company name", variant: "destructive" }); return; }
    if (!rcNumber.trim()) { toast({ title: "Required", description: "Enter RC number", variant: "destructive" }); return; }
    if (!contactName.trim()) { toast({ title: "Required", description: "Enter contact person name", variant: "destructive" }); return; }
    if (!contactPhone.trim()) { toast({ title: "Required", description: "Enter phone number", variant: "destructive" }); return; }
    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < PRICE) { toast({ title: "Insufficient Balance", description: `You need ₦${PRICE.toLocaleString()} but have ₦${walletBalance.toLocaleString()}.`, variant: "destructive" }); return; }

    setIsSubmitting(true);
    try {
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("paystack-payment", { body: { action: "wallet_payment", amount: PRICE, metadata: { transaction_type: "verification", phone_number: contactPhone } } });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) { toast({ title: "Payment Failed", description: paymentData?.error, variant: "destructive" }); setIsSubmitting(false); return; }

      await supabase.from("transactions").insert({ user_id: user!.id, transaction_type: "verification" as any, amount: PRICE, status: "processing" as any, data_plan: "ipe-clearance", api_response: { business_name: businessName, rc_number: rcNumber, business_address: businessAddress, tin_number: tinNumber, contact_name: contactName, contact_phone: contactPhone, contact_email: contactEmail, purpose: purposeOfClearance, additional_info: additionalInfo }, phone_number: contactPhone, balance_before: paymentData.balance_before, balance_after: paymentData.balance_after, description: "IPE Clearance Application" });
      await refreshProfile();
      await loadPreviousRequests();
      toast({ title: "Request Submitted!", description: "Your IPE clearance application has been submitted. Processing takes 7-14 business days." });
      setBusinessName(""); setRcNumber(""); setBusinessAddress(""); setTinNumber(""); setContactName(""); setContactPhone(""); setContactEmail(""); setPurposeOfClearance(""); setAdditionalInfo(""); setConsent(false);
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
    ? previousRequests.filter((r) => r.business_name?.toLowerCase().includes(searchQuery.toLowerCase()) || r.clearance_number?.toLowerCase().includes(searchQuery.toLowerCase()))
    : previousRequests;

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse-soft text-primary">Loading...</div></div>;
  if (!user) return null;

  const features = [
    { icon: "🚢", title: "Import Clearance", desc: "Clear goods for import into Nigeria" },
    { icon: "📦", title: "Export Clearance", desc: "Clear goods for export operations" },
    { icon: "📄", title: "Full Documentation", desc: "Complete paperwork handled for you" },
  ];

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
                <ShieldCheck className="h-5 w-5" />
                <span className="text-base font-bold tracking-tight">IPE Clearance</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-lg px-3 py-1.5">
              <Wallet className="h-4 w-4" />
              <span className="text-sm font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
            </div>
          </div>
        </header>

        {/* Sub navigation */}
        <div className="w-full bg-primary/90 text-primary-foreground border-b border-primary-foreground/10">
          <div className="container flex items-center gap-1 h-10 text-xs">
            <button onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-t-md font-medium transition-colors ${activeTab === "register" ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}>Apply</button>
            <button onClick={() => setActiveTab("retrieve")} className={`px-4 py-2 rounded-t-md font-medium transition-colors ${activeTab === "retrieve" ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}>Status</button>
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
                  Trade Clearance Service
                </div>
                <h2 className="text-3xl font-bold leading-tight">Import/Export<br />Clearance</h2>
                <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-md">Apply for Import/Export (IPE) clearance for your business operations. Required for businesses engaged in international trade within Nigeria.</p>
              </div>

              <div className="space-y-4">
                {features.map((f, i) => (
                  <div key={i} className="flex items-center gap-4 bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/10">
                    <span className="text-2xl">{f.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{f.title}</p>
                      <p className="text-xs text-primary-foreground/60">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-3 bg-primary-foreground/5 backdrop-blur-sm rounded-xl p-4 border border-primary-foreground/10">
                <Clock className="h-5 w-5 flex-shrink-0 mt-0.5 text-secondary" />
                <div className="text-xs text-primary-foreground/70">
                  <p className="font-semibold text-primary-foreground text-sm">Processing: 7-14 business days</p>
                  <p className="mt-1">Your clearance certificate will be available once completed. Fee: ₦{PRICE.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 lg:w-[55%]">
            {/* Mobile hero banner */}
            <div className="lg:hidden gradient-hero text-primary-foreground p-6 space-y-3">
              <h2 className="text-xl font-bold">IPE Clearance</h2>
              <p className="text-xs text-primary-foreground/70">Import/Export clearance for your business. Processing takes 7-14 business days. Fee: ₦{PRICE.toLocaleString()}</p>
            </div>

            <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
              <div className="bg-accent border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-accent-foreground">How it works</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Fill in your business details and submit. Your wallet will be charged ₦{PRICE.toLocaleString()} immediately. Track status under "Status" tab.</p>
                </div>
              </div>

              {activeTab === "register" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">New Application</h3>
                    <p className="text-xs text-muted-foreground">Provide your business details for IPE clearance</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">Business Information</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label className="text-xs font-medium">Business/Company Name <span className="text-destructive">*</span></Label><Input placeholder="Registered business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-11" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs font-medium">RC Number <span className="text-destructive">*</span></Label><Input placeholder="e.g. RC1234567" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} className="h-11" /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-medium">TIN</Label><Input placeholder="Tax ID number" value={tinNumber} onChange={(e) => setTinNumber(e.target.value)} className="h-11" /></div>
                      </div>
                      <div className="space-y-1.5"><Label className="text-xs font-medium">Business Address</Label><Input placeholder="Registered business address" value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="h-11" /></div>
                      <div className="space-y-1.5"><Label className="text-xs font-medium">Purpose of Clearance</Label><Input placeholder="e.g. Import of electronics, Export of agricultural goods" value={purposeOfClearance} onChange={(e) => setPurposeOfClearance(e.target.value)} className="h-11" /></div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <FileText className="h-4 w-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">Contact Person</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5"><Label className="text-xs font-medium">Full Name <span className="text-destructive">*</span></Label><Input placeholder="Contact person name" value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-11" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5"><Label className="text-xs font-medium">Phone <span className="text-destructive">*</span></Label><Input type="tel" placeholder="08012345678" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={15} className="h-11" /></div>
                        <div className="space-y-1.5"><Label className="text-xs font-medium">Email</Label><Input type="email" placeholder="email@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-11" /></div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5"><Label className="text-xs font-medium">Additional Information</Label><Textarea placeholder="Any additional details or documents needed..." value={additionalInfo} onChange={(e) => setAdditionalInfo(e.target.value)} rows={3} /></div>

                  <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                    <div className="flex items-start gap-2">
                      <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                      <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">I confirm the information is accurate and authorize this IPE clearance application.</Label>
                    </div>
                    <Button className="w-full h-12 text-base font-bold" onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? <><Clock className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <>Submit Application <ChevronRight className="h-4 w-4 ml-1" /> — ₦{PRICE.toLocaleString()}</>}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === "retrieve" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Track Status</h3>
                    <p className="text-xs text-muted-foreground">View and track your IPE clearance applications</p>
                  </div>
                  <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search by business name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-11" /></div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{filteredRequests.length} request(s)</p>
                    <Button variant="ghost" size="sm" onClick={loadPreviousRequests} disabled={isLoadingRequests}><RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingRequests ? "animate-spin" : ""}`} />Refresh</Button>
                  </div>
                  {filteredRequests.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground"><AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm font-medium">{searchQuery ? "No matching requests" : "No IPE requests yet"}</p>{!searchQuery && <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("register")}><FileText className="h-3.5 w-3.5 mr-1" />Apply Now</Button>}</CardContent></Card>
                  ) : (
                    <div className="space-y-3">
                      {filteredRequests.map((req) => (
                        <Card key={req.id} className={req.status === "completed" ? "border-emerald-500/30" : ""}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between"><span className="text-sm font-semibold">{req.business_name || "IPE Application"}</span>{getStatusBadge(req.status)}</div>
                            <p className="text-xs text-muted-foreground">Submitted: {new Date(req.created_at).toLocaleDateString()}</p>
                            {req.status === "completed" && req.clearance_number && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-emerald-600 font-medium">Clearance No.</p><p className="text-lg font-bold font-mono text-emerald-700">{req.clearance_number}</p></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyText(req.clearance_number!)}><Copy className="h-4 w-4 text-emerald-600" /></Button></div></div>
                            )}
                            {req.status === "processing" && <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600 animate-pulse" /><p className="text-xs text-amber-600">Processing... Check back in 7-14 business days.</p></div>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 text-center text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} The Eagles Charge • IPE Clearance Service
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default IpeClearance;
