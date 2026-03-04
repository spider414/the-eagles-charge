import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  Wallet,
  User,
  Building2,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  Copy,
  Info,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

type RetrievalType = "individual" | "corporate";

const typeOptions = [
  { value: "individual" as RetrievalType, label: "Individual", price: 800, description: "Personal TIN registration using NIN", icon: "👤" },
  { value: "corporate" as RetrievalType, label: "Corporate", price: 1200, description: "Business/company TIN registration", icon: "🏢" },
];

interface TinRequest {
  id: string;
  type: RetrievalType;
  nin?: string;
  business_name?: string;
  rc_number?: string;
  full_name?: string;
  phone?: string;
  email?: string;
  status: "pending" | "processing" | "completed" | "failed";
  tin?: string;
  created_at: string;
}

const TinRegistration = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("register");
  const [retrievalType, setRetrievalType] = useState<RetrievalType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [consent, setConsent] = useState(false);

  const [ninNumber, setNinNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  const [previousRequests, setPreviousRequests] = useState<TinRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => { if (!isLoading && !user) navigate("/auth"); }, [user, isLoading, navigate]);
  useEffect(() => { if (user) loadPreviousRequests(); }, [user]);

  const price = retrievalType === "individual" ? 800 : retrievalType === "corporate" ? 1200 : 0;

  const loadPreviousRequests = async () => {
    if (!user) return;
    setIsLoadingRequests(true);
    try {
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).like("data_plan", "tin-%").order("created_at", { ascending: false }).limit(20);
      if (data) {
        setPreviousRequests(data.map((t: any) => {
          const apiRes = t.api_response as any;
          return { id: t.id, type: t.data_plan?.includes("corporate") ? "corporate" : "individual", nin: apiRes?.nin, business_name: apiRes?.business_name, rc_number: apiRes?.rc_number, full_name: apiRes?.full_name, phone: apiRes?.phone, email: apiRes?.email, status: t.status as any, tin: apiRes?.tin, created_at: t.created_at };
        }));
      }
    } catch {} finally { setIsLoadingRequests(false); }
  };

  const handleSubmit = async () => {
    if (!retrievalType) { toast({ title: "Select Type", description: "Please select Individual or Corporate", variant: "destructive" }); return; }
    if (!consent) { toast({ title: "Consent Required", description: "Please agree to the terms", variant: "destructive" }); return; }
    if (retrievalType === "individual") {
      if (!ninNumber || ninNumber.replace(/\D/g, "").length !== 11) { toast({ title: "Invalid NIN", description: "NIN must be exactly 11 digits", variant: "destructive" }); return; }
      if (!fullName.trim()) { toast({ title: "Name Required", variant: "destructive" }); return; }
    } else {
      if (!businessName.trim()) { toast({ title: "Business Name Required", variant: "destructive" }); return; }
      if (!rcNumber.trim()) { toast({ title: "RC Number Required", variant: "destructive" }); return; }
      if (!contactName.trim()) { toast({ title: "Contact Name Required", variant: "destructive" }); return; }
    }
    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < price) { toast({ title: "Insufficient Balance", description: `You need ₦${price} but have ₦${walletBalance.toLocaleString()}.`, variant: "destructive" }); return; }

    setIsSubmitting(true);
    try {
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("paystack-payment", { body: { action: "wallet_payment", amount: price, metadata: { transaction_type: "verification", phone_number: retrievalType === "individual" ? ninNumber : rcNumber } } });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) { toast({ title: "Payment Failed", description: paymentData?.error, variant: "destructive" }); setIsSubmitting(false); return; }

      const apiResponse = retrievalType === "individual"
        ? { nin: ninNumber.replace(/\D/g, ""), full_name: fullName, phone, email, type: "individual" }
        : { business_name: businessName, rc_number: rcNumber, contact_name: contactName, contact_phone: contactPhone, contact_email: contactEmail, type: "corporate" };

      await supabase.from("transactions").insert({ user_id: user!.id, transaction_type: "verification" as any, amount: price, status: "processing" as any, data_plan: `tin-${retrievalType}`, api_response: apiResponse, phone_number: retrievalType === "individual" ? ninNumber : rcNumber, balance_before: paymentData.balance_before, balance_after: paymentData.balance_after, description: `TIN ${retrievalType === "individual" ? "Individual" : "Corporate"} Registration/Retrieval` });
      await refreshProfile();
      await loadPreviousRequests();
      toast({ title: "Request Submitted!", description: "Your TIN request has been submitted. Check the 'Retrieve TIN' tab for updates." });
      setRetrievalType(null); setConsent(false); setNinNumber(""); setFullName(""); setPhone(""); setEmail(""); setBusinessName(""); setRcNumber(""); setContactName(""); setContactPhone(""); setContactEmail("");
      setActiveTab("retrieve");
    } catch (err: any) {
      try { await supabase.functions.invoke("paystack-payment", { body: { action: "credit_wallet", amount: price } }); await refreshProfile(); } catch {}
      toast({ title: "Error", description: err.message || "Something went wrong. Wallet refunded.", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const copyTin = (tin: string) => { navigator.clipboard.writeText(tin); toast({ title: "Copied!", description: "TIN copied to clipboard" }); };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Completed</Badge>;
      case "processing": return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Processing</Badge>;
      case "pending": return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Pending</Badge>;
      case "failed": return <Badge variant="destructive">Failed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = searchQuery.trim()
    ? previousRequests.filter((r) => { const q = searchQuery.toLowerCase(); return r.nin?.toLowerCase().includes(q) || r.rc_number?.toLowerCase().includes(q) || r.full_name?.toLowerCase().includes(q) || r.business_name?.toLowerCase().includes(q) || r.tin?.toLowerCase().includes(q); })
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
                <FileText className="h-5 w-5" />
                <span className="text-base font-bold tracking-tight">Federal Inland Revenue Service</span>
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
            <button onClick={() => setActiveTab("register")} className={`px-4 py-2 rounded-t-md font-medium transition-colors ${activeTab === "register" ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}>Register</button>
            <button onClick={() => setActiveTab("retrieve")} className={`px-4 py-2 rounded-t-md font-medium transition-colors ${activeTab === "retrieve" ? "bg-background text-foreground" : "hover:bg-primary-foreground/10"}`}>Retrieve TIN</button>
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
                  Official TIN Service
                </div>
                <h2 className="text-3xl font-bold leading-tight">TIN Registration<br />& Retrieval</h2>
                <p className="text-primary-foreground/70 text-sm leading-relaxed max-w-md">Register or retrieve your Tax Identification Number (TIN) issued by the Federal Inland Revenue Service.</p>
              </div>

              <div className="space-y-4">
                {typeOptions.map((opt) => (
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
                  <p className="font-semibold text-primary-foreground text-sm">Processing: Up to 24 hours</p>
                  <p className="mt-1">Track your TIN request status and retrieve your TIN upon completion.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right form panel */}
          <div className="flex-1 lg:w-[55%]">
            {/* Mobile hero banner */}
            <div className="lg:hidden gradient-hero text-primary-foreground p-6 space-y-3">
              <h2 className="text-xl font-bold">TIN Registration & Retrieval</h2>
              <p className="text-xs text-primary-foreground/70">Register or retrieve your Tax Identification Number. Processing takes up to 24 hours.</p>
              <div className="flex flex-wrap gap-2">
                {typeOptions.map((opt) => (
                  <span key={opt.value} className="text-[10px] bg-primary-foreground/10 rounded-full px-3 py-1 font-medium">{opt.label} — ₦{opt.price.toLocaleString()}</span>
                ))}
              </div>
            </div>

            <div className="p-6 lg:p-10 max-w-xl mx-auto space-y-6">
              <div className="bg-accent border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-accent-foreground">How it works</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Select Individual or Corporate, fill in your details, and submit. Your wallet will be charged immediately. Check "Retrieve TIN" tab for updates.</p>
                </div>
              </div>

              {activeTab === "register" && (
                <div className="space-y-5 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">New Registration</h3>
                    <p className="text-xs text-muted-foreground">Select your registration type and fill out the form</p>
                  </div>

                  {/* Type selection cards */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">Select Registration Type</Label>
                    <div className="grid gap-3">
                      {typeOptions.map((opt) => (
                        <button key={opt.value} onClick={() => setRetrievalType(opt.value)} className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${retrievalType === opt.value ? "border-primary bg-accent shadow-sm" : "border-border hover:border-primary/40 bg-card"}`}>
                          <span className="text-2xl">{opt.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground">{opt.label}</p>
                            <p className="text-xs text-muted-foreground">{opt.description}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-primary">₦{opt.price.toLocaleString()}</p>
                          </div>
                          {retrievalType === opt.value && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {retrievalType && (
                    <div className="space-y-5 animate-fade-in">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                          {retrievalType === "individual" ? <User className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
                          <h4 className="text-sm font-bold text-foreground">{retrievalType === "individual" ? "Personal Details" : "Corporate Details"}</h4>
                        </div>

                        {retrievalType === "individual" ? (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">NIN (11 digits) <span className="text-destructive">*</span></Label>
                              <Input placeholder="Enter 11-digit NIN" value={ninNumber} onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, ""))} maxLength={11} className="h-11" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Full Name <span className="text-destructive">*</span></Label>
                              <Input placeholder="As it appears on your NIN" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Phone Number</Label>
                                <Input type="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} className="h-11" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Email</Label>
                                <Input type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Business/Company Name <span className="text-destructive">*</span></Label>
                              <Input placeholder="Registered business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="h-11" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">RC/BN Number <span className="text-destructive">*</span></Label>
                              <Input placeholder="e.g. RC1234567" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} className="h-11" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs font-medium">Contact Person <span className="text-destructive">*</span></Label>
                              <Input placeholder="Full name of contact person" value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-11" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Phone</Label>
                                <Input type="tel" placeholder="08012345678" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={15} className="h-11" />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-medium">Email</Label>
                                <Input type="email" placeholder="email@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-11" />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Consent & Submit */}
                      <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                        <div className="flex items-start gap-2">
                          <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                          <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">I confirm the information is accurate and authorize TIN retrieval on my behalf.</Label>
                        </div>
                        <Button className="w-full h-12 text-base font-bold" onClick={handleSubmit} disabled={isSubmitting}>
                          {isSubmitting ? <><Clock className="h-4 w-4 mr-2 animate-spin" />Submitting...</> : <>Submit Request <ChevronRight className="h-4 w-4 ml-1" /> — ₦{price.toLocaleString()}</>}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "retrieve" && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">Retrieve TIN</h3>
                    <p className="text-xs text-muted-foreground">View and track your TIN registration requests</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by NIN, RC number, name, or TIN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-11" />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{filteredRequests.length} request(s)</p>
                    <Button variant="ghost" size="sm" onClick={loadPreviousRequests} disabled={isLoadingRequests}><RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingRequests ? "animate-spin" : ""}`} />Refresh</Button>
                  </div>
                  {filteredRequests.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-muted-foreground"><AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm font-medium">{searchQuery ? "No matching requests" : "No TIN requests yet"}</p>{!searchQuery && <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("register")}><FileText className="h-3.5 w-3.5 mr-1" />Register Now</Button>}</CardContent></Card>
                  ) : (
                    <div className="space-y-3">
                      {filteredRequests.map((req) => (
                        <Card key={req.id} className={req.status === "completed" && req.tin ? "border-emerald-500/30" : ""}>
                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {req.type === "individual" ? <User className="h-4 w-4 text-muted-foreground" /> : <Building2 className="h-4 w-4 text-muted-foreground" />}
                                <span className="text-sm font-semibold capitalize">{req.type}</span>
                              </div>
                              {getStatusBadge(req.status)}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {req.full_name && <p>Name: <span className="text-foreground">{req.full_name}</span></p>}
                              {req.business_name && <p>Business: <span className="text-foreground">{req.business_name}</span></p>}
                              <p>Submitted: <span className="text-foreground">{new Date(req.created_at).toLocaleDateString()}</span></p>
                            </div>
                            {req.status === "completed" && req.tin && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3"><div className="flex items-center justify-between"><div><p className="text-xs text-emerald-600 font-medium">Your TIN</p><p className="text-lg font-bold font-mono text-emerald-700 tracking-wider">{req.tin}</p></div><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyTin(req.tin!)}><Copy className="h-4 w-4 text-emerald-600" /></Button></div></div>
                            )}
                            {req.status === "processing" && <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2"><Clock className="h-4 w-4 text-amber-600 animate-pulse" /><p className="text-xs text-amber-600">Processing... Check back within 24 hours.</p></div>}
                            {req.status === "failed" && <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /><p className="text-xs text-destructive">Request failed. Wallet refunded.</p></div>}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border p-4 text-center text-[10px] text-muted-foreground">
              © {new Date().getFullYear()} The Eagles Charge • TIN Registration Service
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
};

export default TinRegistration;
