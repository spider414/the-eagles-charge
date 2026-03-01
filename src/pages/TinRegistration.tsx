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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

type RetrievalType = "individual" | "corporate";

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

  // Individual fields
  const [ninNumber, setNinNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Corporate fields
  const [businessName, setBusinessName] = useState("");
  const [rcNumber, setRcNumber] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");

  // Status check / Retrieve
  const [previousRequests, setPreviousRequests] = useState<TinRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) loadPreviousRequests();
  }, [user]);

  const price = retrievalType === "individual" ? 800 : retrievalType === "corporate" ? 1200 : 0;

  const loadPreviousRequests = async () => {
    if (!user) return;
    setIsLoadingRequests(true);
    try {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .like("data_plan", "tin-%")
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) {
        const requests: TinRequest[] = data.map((t: any) => {
          const apiRes = t.api_response as any;
          return {
            id: t.id,
            type: t.data_plan?.includes("corporate") ? "corporate" : "individual",
            nin: apiRes?.nin,
            business_name: apiRes?.business_name,
            rc_number: apiRes?.rc_number,
            full_name: apiRes?.full_name,
            phone: apiRes?.phone,
            email: apiRes?.email,
            status: t.status as any,
            tin: apiRes?.tin,
            created_at: t.created_at,
          };
        });
        setPreviousRequests(requests);
      }
    } catch {
      // silent
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleSubmit = async () => {
    if (!retrievalType) {
      toast({ title: "Select Type", description: "Please select Individual or Corporate", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Consent Required", description: "Please agree to the terms before proceeding", variant: "destructive" });
      return;
    }

    if (retrievalType === "individual") {
      if (!ninNumber || ninNumber.replace(/\D/g, "").length !== 11) {
        toast({ title: "Invalid NIN", description: "NIN must be exactly 11 digits", variant: "destructive" });
        return;
      }
      if (!fullName.trim()) {
        toast({ title: "Name Required", description: "Please enter your full name", variant: "destructive" });
        return;
      }
    } else {
      if (!businessName.trim()) {
        toast({ title: "Business Name Required", description: "Please enter the business/company name", variant: "destructive" });
        return;
      }
      if (!rcNumber.trim()) {
        toast({ title: "RC Number Required", description: "Please enter the RC/BN number", variant: "destructive" });
        return;
      }
      if (!contactName.trim()) {
        toast({ title: "Contact Name Required", description: "Please enter a contact person name", variant: "destructive" });
        return;
      }
    }

    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < price) {
      toast({ title: "Insufficient Balance", description: `You need ₦${price} but have ₦${walletBalance.toLocaleString()}. Please top up your wallet.`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("paystack-payment", {
        body: {
          action: "wallet_payment",
          amount: price,
          metadata: {
            transaction_type: "verification",
            phone_number: retrievalType === "individual" ? ninNumber : rcNumber,
          },
        },
      });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) {
        toast({ title: "Payment Failed", description: paymentData?.error || "Failed to debit wallet.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const apiResponse = retrievalType === "individual"
        ? { nin: ninNumber.replace(/\D/g, ""), full_name: fullName, phone, email, type: "individual" }
        : { business_name: businessName, rc_number: rcNumber, contact_name: contactName, contact_phone: contactPhone, contact_email: contactEmail, type: "corporate" };

      await supabase.from("transactions").insert({
        user_id: user!.id,
        transaction_type: "verification" as any,
        amount: price,
        status: "processing" as any,
        data_plan: `tin-${retrievalType}`,
        api_response: apiResponse,
        phone_number: retrievalType === "individual" ? ninNumber : rcNumber,
        balance_before: paymentData.balance_before,
        balance_after: paymentData.balance_after,
        description: `TIN ${retrievalType === "individual" ? "Individual" : "Corporate"} Registration/Retrieval`,
      });

      await refreshProfile();
      await loadPreviousRequests();

      toast({ title: "Request Submitted!", description: "Your TIN request has been submitted. It takes up to 24 hours to process. Check the 'Retrieve TIN' tab for updates." });

      // Reset form
      setRetrievalType(null);
      setConsent(false);
      setNinNumber("");
      setFullName("");
      setPhone("");
      setEmail("");
      setBusinessName("");
      setRcNumber("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setActiveTab("retrieve");
    } catch (err: any) {
      try {
        await supabase.functions.invoke("paystack-payment", {
          body: { action: "credit_wallet", amount: price },
        });
        await refreshProfile();
      } catch {}
      toast({ title: "Error", description: err.message || "Something went wrong. Wallet refunded.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyTin = (tin: string) => {
    navigator.clipboard.writeText(tin);
    toast({ title: "Copied!", description: "TIN copied to clipboard" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Completed</Badge>;
      case "processing":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Processing</Badge>;
      case "pending":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = searchQuery.trim()
    ? previousRequests.filter((r) => {
        const q = searchQuery.toLowerCase();
        return (
          r.nin?.toLowerCase().includes(q) ||
          r.rc_number?.toLowerCase().includes(q) ||
          r.full_name?.toLowerCase().includes(q) ||
          r.business_name?.toLowerCase().includes(q) ||
          r.tin?.toLowerCase().includes(q)
        );
      })
    : previousRequests;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/verification")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold shadow-gold">
                  <FileText className="h-5 w-5 text-secondary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">TIN Service</span>
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
            <h1 className="text-2xl font-bold text-foreground">TIN Registration/Retrieval</h1>
            <p className="text-sm text-muted-foreground">Register or retrieve your Tax Identification Number</p>
          </div>

          {/* Info banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-700">Processing takes up to 24 hours</p>
              <p className="text-amber-600/80 text-xs mt-0.5">After registration, switch to the "Retrieve TIN" tab to check your status and get your TIN.</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="register" className="gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Register
              </TabsTrigger>
              <TabsTrigger value="retrieve" className="gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Retrieve TIN
              </TabsTrigger>
            </TabsList>

            {/* ─── Register Tab ─── */}
            <TabsContent value="register" className="space-y-5 mt-4">
              {/* Retrieval Type Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Select Registration Type</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <button
                    onClick={() => setRetrievalType("individual")}
                    className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                      retrievalType === "individual"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        retrievalType === "individual" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground">Individual</p>
                          <span className="text-sm font-bold text-primary">₦800.00</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">For personal TIN registration/retrieval using NIN</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setRetrievalType("corporate")}
                    className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                      retrievalType === "corporate"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        retrievalType === "corporate" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground">Corporate</p>
                          <span className="text-sm font-bold text-primary">₦1,200.00</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">For business/company TIN registration/retrieval</p>
                      </div>
                    </div>
                  </button>
                </CardContent>
              </Card>

              {/* Form */}
              {retrievalType && (
                <Card className="animate-fade-in">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {retrievalType === "individual" ? <User className="h-4 w-4 text-primary" /> : <Building2 className="h-4 w-4 text-primary" />}
                      {retrievalType === "individual" ? "Individual Details" : "Corporate Details"}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {retrievalType === "individual"
                        ? "Provide your NIN and personal details for TIN retrieval"
                        : "Provide your company details for TIN registration/retrieval"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {retrievalType === "individual" ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="nin">NIN (11 digits) *</Label>
                          <Input id="nin" type="text" placeholder="Enter 11-digit NIN" value={ninNumber} onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, ""))} maxLength={11} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fullName">Full Name *</Label>
                          <Input id="fullName" placeholder="As it appears on your NIN" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" type="tel" placeholder="08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={15} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="bizName">Business/Company Name *</Label>
                          <Input id="bizName" placeholder="Registered business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="rcNum">RC/BN Number *</Label>
                          <Input id="rcNum" placeholder="e.g. RC1234567" value={rcNumber} onChange={(e) => setRcNumber(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactName">Contact Person *</Label>
                          <Input id="contactName" placeholder="Full name of contact person" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="cPhone">Phone</Label>
                            <Input id="cPhone" type="tel" placeholder="08012345678" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={15} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="cEmail">Email</Label>
                            <Input id="cEmail" type="email" placeholder="email@example.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                      <p><strong>Note:</strong> TIN registration/retrieval is processed within 24 hours. Switch to the "Retrieve TIN" tab to check status.</p>
                    </div>

                    <div className="flex items-start gap-2">
                      <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                      <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        I confirm that the information provided is accurate and I authorize the retrieval of TIN on my behalf.
                      </Label>
                    </div>

                    <Button className="w-full" onClick={handleSubmit} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <><Clock className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                      ) : (
                        <><FileText className="h-4 w-4 mr-2" />Submit Request - ₦{price.toLocaleString()}</>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ─── Retrieve TIN Tab ─── */}
            <TabsContent value="retrieve" className="space-y-4 mt-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by NIN, RC number, name, or TIN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {filteredRequests.length} {filteredRequests.length === 1 ? "request" : "requests"} found
                </p>
                <Button variant="ghost" size="sm" onClick={loadPreviousRequests} disabled={isLoadingRequests}>
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingRequests ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {filteredRequests.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">
                      {searchQuery ? "No matching requests found" : "No TIN requests yet"}
                    </p>
                    <p className="text-xs mt-1">
                      {searchQuery
                        ? "Try a different search term"
                        : "Submit a registration request to get started"}
                    </p>
                    {!searchQuery && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setActiveTab("register")}>
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Register Now
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {filteredRequests.map((req) => (
                    <Card key={req.id} className={req.status === "completed" && req.tin ? "border-emerald-500/30" : ""}>
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {req.type === "individual" ? (
                              <User className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm font-semibold capitalize">{req.type}</span>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>

                        <div className="text-xs text-muted-foreground space-y-0.5">
                          {req.full_name && <p>Name: <span className="text-foreground">{req.full_name}</span></p>}
                          {req.business_name && <p>Business: <span className="text-foreground">{req.business_name}</span></p>}
                          {req.nin && <p>NIN: <span className="text-foreground font-mono">{req.nin}</span></p>}
                          {req.rc_number && <p>RC: <span className="text-foreground font-mono">{req.rc_number}</span></p>}
                          <p>Submitted: <span className="text-foreground">{new Date(req.created_at).toLocaleDateString()}</span></p>
                        </div>

                        {req.status === "completed" && req.tin && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs text-emerald-600 font-medium">Your TIN</p>
                                <p className="text-lg font-bold font-mono text-emerald-700 tracking-wider">{req.tin}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyTin(req.tin!)}>
                                <Copy className="h-4 w-4 text-emerald-600" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {req.status === "processing" && (
                          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600 animate-pulse" />
                            <p className="text-xs text-amber-600">Processing... Please check back within 24 hours.</p>
                          </div>
                        )}

                        {req.status === "failed" && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <p className="text-xs text-destructive">Request failed. Your wallet has been refunded.</p>
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

export default TinRegistration;
