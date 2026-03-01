import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Fingerprint,
  Phone,
  ShieldCheck,
  FileSearch,
  Users,
  CreditCard,
  Printer,
  Building2,
  FileText,
  ArrowLeft,
  Wallet,
  Sparkles,
  Clock,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

interface VerificationResult {
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  nin?: string;
  bvn?: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  state?: string;
  state_of_origin?: string;
  state_of_residence?: string;
  nationality?: string;
  address?: string;
  photo?: string | null;
}

type ServiceId = "nin-verification" | "nin-phone" | "nin-tracking" | "nin-demography" | "bvn-verification" | "bvn-phone";

interface ServiceConfig {
  id: ServiceId;
  title: string;
  description: string;
  icon: typeof ShieldCheck;
  color: string;
  price: string;
  priceNum: number;
  status: "active" | "coming_soon";
  category: "nin" | "bvn" | "other";
  edgeFunction: string;
}

const services: ServiceConfig[] = [
  { id: "nin-verification", title: "NIN Verification", description: "Verify NIN by number", icon: ShieldCheck, color: "bg-primary", price: "₦300", priceNum: 300, status: "active", category: "nin", edgeFunction: "verify-nin" },
  { id: "nin-phone", title: "NIN With Phone", description: "Search NIN by phone number", icon: Phone, color: "bg-emerald-500", price: "₦500", priceNum: 500, status: "active", category: "nin", edgeFunction: "verify-nin-phone" },
  { id: "nin-tracking", title: "NIN Tracking", description: "Search NIN by tracking ID", icon: Search, color: "bg-teal-500", price: "₦400", priceNum: 400, status: "active", category: "nin", edgeFunction: "verify-nin-tracking" },
  { id: "nin-demography", title: "NIN Demography", description: "Search NIN by demographics", icon: Users, color: "bg-cyan-600", price: "₦500", priceNum: 500, status: "active", category: "nin", edgeFunction: "verify-nin-demography" },
  { id: "bvn-verification", title: "BVN Verification", description: "Verify BVN by number", icon: CreditCard, color: "bg-blue-600", price: "₦500", priceNum: 500, status: "active", category: "bvn", edgeFunction: "verify-bvn" },
  { id: "bvn-phone", title: "BVN With Phone", description: "Search BVN by phone number", icon: Phone, color: "bg-sky-500", price: "₦400", priceNum: 400, status: "active", category: "bvn", edgeFunction: "verify-bvn-phone" },
];

const otherServices = [
  { title: "Print NIN Slip", icon: Printer, color: "bg-indigo-500", badge: null, route: "/nin-print" },
  { title: "Print BVN Slip", icon: Printer, color: "bg-violet-500", badge: null, route: "/bvn-print" },
  { title: "TIN Registration", icon: FileText, color: "bg-orange-500", badge: null, route: null },
  { title: "CAC Registration", icon: Building2, color: "bg-amber-600", badge: null, route: null },
  { title: "SCUML Registration", icon: FileText, color: "bg-rose-500", badge: "NEW", route: null },
  { title: "IPE Clearance", icon: ShieldCheck, color: "bg-red-600", badge: null, route: null },
];

const Verification = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const { toast } = useToast();

  const [activeService, setActiveService] = useState<ServiceId | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Form fields
  const [phoneNumber, setPhoneNumber] = useState("");
  const [ninNumber, setNinNumber] = useState("");
  const [bvnNumber, setBvnNumber] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [state, setState] = useState("");

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const resetForm = () => {
    setPhoneNumber("");
    setNinNumber("");
    setBvnNumber("");
    setTrackingId("");
    setFirstname("");
    setLastname("");
    setGender("");
    setDob("");
    setState("");
    setResult(null);
  };

  const handleVerify = async () => {
    if (!activeService) return;

    const service = services.find((s) => s.id === activeService);
    if (!service) return;

    let body: Record<string, unknown> = {};

    switch (activeService) {
      case "nin-verification":
        if (!ninNumber || ninNumber.replace(/\D/g, "").length !== 11) {
          toast({ title: "Invalid NIN", description: "NIN must be exactly 11 digits", variant: "destructive" });
          return;
        }
        body = { nin: ninNumber };
        break;
      case "nin-phone":
      case "bvn-phone":
        if (!phoneNumber || phoneNumber.replace(/\D/g, "").length < 10) {
          toast({ title: "Invalid Phone", description: "Enter a valid phone number", variant: "destructive" });
          return;
        }
        body = { phone_number: phoneNumber };
        break;
      case "nin-tracking":
        if (!trackingId || trackingId.trim().length < 5) {
          toast({ title: "Invalid Tracking ID", description: "Enter a valid tracking ID", variant: "destructive" });
          return;
        }
        body = { tracking_id: trackingId };
        break;
      case "nin-demography":
        if (!firstname || !lastname || !gender || !dob) {
          toast({ title: "Missing Fields", description: "Fill in all required fields", variant: "destructive" });
          return;
        }
        body = { firstname, lastname, gender, dob };
        break;
      case "bvn-verification":
        if (!bvnNumber || bvnNumber.replace(/\D/g, "").length !== 11) {
          toast({ title: "Invalid BVN", description: "BVN must be exactly 11 digits", variant: "destructive" });
          return;
        }
        body = { bvn: bvnNumber };
        break;
    }

    // Check wallet balance
    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < service.priceNum) {
      toast({ title: "Insufficient Balance", description: `You need ₦${service.priceNum} but have ₦${walletBalance.toLocaleString()}. Please top up your wallet.`, variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    setResult(null);

    try {
      // Debit wallet first
      const { data: debitResult, error: debitError } = await supabase.rpc("debit_wallet", {
        p_profile_id: profile!.id,
        p_amount: service.priceNum,
      });
      if (debitError) throw debitError;
      const debitSuccess = debitResult?.[0]?.success;
      if (!debitSuccess) {
        toast({ title: "Insufficient Balance", description: "Failed to debit wallet. Please top up.", variant: "destructive" });
        setIsVerifying(false);
        return;
      }

      // Call verification API
      const { data, error } = await supabase.functions.invoke(service.edgeFunction, { body });
      if (error) throw error;

      if (data?.success) {
        setResult(data.data);
        // Save transaction
        await supabase.from("transactions").insert({
          user_id: user!.id,
          transaction_type: "verification" as any,
          amount: service.priceNum,
          status: "completed",
          data_plan: service.id,
          api_response: data.data,
          phone_number: ninNumber || bvnNumber || phoneNumber || trackingId,
        });
        toast({ title: "Success!", description: "Verification completed successfully" });
      } else {
        // Refund on failure
        await supabase.rpc("credit_wallet", { p_profile_id: profile!.id, p_amount: service.priceNum });
        // Save failed transaction
        await supabase.from("transactions").insert({
          user_id: user!.id,
          transaction_type: "verification" as any,
          amount: service.priceNum,
          status: "failed",
          data_plan: service.id,
          api_response: { error: data?.error },
          phone_number: ninNumber || bvnNumber || phoneNumber || trackingId,
        });
        toast({ title: "Failed", description: data?.error || "Verification failed. Wallet refunded.", variant: "destructive" });
      }
    } catch (err: any) {
      // Refund on error
      try {
        await supabase.rpc("credit_wallet", { p_profile_id: profile!.id, p_amount: service.priceNum });
      } catch {}
      toast({ title: "Error", description: err.message || "Something went wrong. Wallet refunded.", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const renderForm = () => {
    switch (activeService) {
      case "nin-verification":
        return (
          <div className="space-y-2">
            <Label htmlFor="nin">NIN Number (11 digits)</Label>
            <Input id="nin" type="text" placeholder="e.g. 12345678901" value={ninNumber} onChange={(e) => setNinNumber(e.target.value)} maxLength={11} />
          </div>
        );
      case "nin-phone":
      case "bvn-phone":
        return (
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input id="phone" type="tel" placeholder="e.g. 08012345678" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} maxLength={15} />
          </div>
        );
      case "nin-tracking":
        return (
          <div className="space-y-2">
            <Label htmlFor="tracking">Tracking ID</Label>
            <Input id="tracking" type="text" placeholder="Enter tracking ID" value={trackingId} onChange={(e) => setTrackingId(e.target.value)} />
          </div>
        );
      case "nin-demography":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fname">First Name *</Label>
                <Input id="fname" placeholder="First name" value={firstname} onChange={(e) => setFirstname(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lname">Last Name *</Label>
                <Input id="lname" placeholder="Last name" value={lastname} onChange={(e) => setLastname(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gender *</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
              </div>
            </div>
          </div>
        );
      case "bvn-verification":
        return (
          <div className="space-y-2">
            <Label htmlFor="bvn">BVN Number (11 digits)</Label>
            <Input id="bvn" type="text" placeholder="e.g. 12345678901" value={bvnNumber} onChange={(e) => setBvnNumber(e.target.value)} maxLength={11} />
          </div>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const activeConfig = services.find((s) => s.id === activeService);

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold shadow-gold">
                  <Fingerprint className="h-5 w-5 text-secondary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">Verifications</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
            </div>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-6">
          {/* Active Service Panel */}
          {activeService && activeConfig && (
            <Card className="border-primary/20 shadow-card animate-fade-in">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <activeConfig.icon className="h-5 w-5 text-primary" />
                    {activeConfig.title}
                    <Badge variant="outline" className="text-[10px] ml-1">{activeConfig.price}</Badge>
                  </CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => { setActiveService(null); resetForm(); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderForm()}
                <Button className="w-full" onClick={handleVerify} disabled={isVerifying}>
                  {isVerifying ? (
                    <><Clock className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2" />Verify Now</>
                  )}
                </Button>

                {result && (
                  <Card className="bg-accent/30 border-primary/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <CheckCircle2 className="h-5 w-5" />
                        Verification Successful
                      </div>
                      {result.photo && (
                        <div className="flex justify-center">
                          <img src={result.photo.startsWith("data:") ? result.photo : `data:image/jpeg;base64,${result.photo}`} alt="Photo" className="w-24 h-24 rounded-xl object-cover border-2 border-primary/20" />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {result.full_name && <div><p className="text-muted-foreground">Full Name</p><p className="font-semibold">{result.full_name}</p></div>}
                        {result.nin && <div><p className="text-muted-foreground">NIN</p><p className="font-mono font-semibold">{result.nin}</p></div>}
                        {result.bvn && <div><p className="text-muted-foreground">BVN</p><p className="font-mono font-semibold">{result.bvn}</p></div>}
                        {result.gender && <div><p className="text-muted-foreground">Gender</p><p className="font-semibold capitalize">{result.gender}</p></div>}
                        {result.date_of_birth && <div><p className="text-muted-foreground">Date of Birth</p><p className="font-semibold">{result.date_of_birth}</p></div>}
                        {result.phone && <div><p className="text-muted-foreground">Phone</p><p className="font-semibold">{result.phone}</p></div>}
                        {result.email && <div><p className="text-muted-foreground">Email</p><p className="font-semibold">{result.email}</p></div>}
                        {result.state && <div><p className="text-muted-foreground">State</p><p className="font-semibold">{result.state}</p></div>}
                        {result.state_of_origin && <div><p className="text-muted-foreground">State of Origin</p><p className="font-semibold">{result.state_of_origin}</p></div>}
                        {result.state_of_residence && <div><p className="text-muted-foreground">State of Residence</p><p className="font-semibold">{result.state_of_residence}</p></div>}
                        {result.nationality && <div><p className="text-muted-foreground">Nationality</p><p className="font-semibold">{result.nationality}</p></div>}
                        {result.address && <div className="col-span-2"><p className="text-muted-foreground">Address</p><p className="font-semibold">{result.address}</p></div>}
                        {result.address && <div className="col-span-2"><p className="text-muted-foreground">Address</p><p className="font-semibold">{result.address}</p></div>}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}

          {/* NIN Services */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">NIN Services</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.filter((s) => s.category === "nin").map((service) => (
                <Card
                  key={service.id}
                  className={`relative hover:shadow-card hover:border-primary/20 transition-all cursor-pointer ${activeService === service.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => { setActiveService(service.id); resetForm(); }}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl ${service.color} flex items-center justify-center`}>
                      <service.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{service.title}</span>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{service.price}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* BVN Services */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">BVN Services</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.filter((s) => s.category === "bvn").map((service) => (
                <Card
                  key={service.id}
                  className={`relative hover:shadow-card hover:border-primary/20 transition-all cursor-pointer ${activeService === service.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => { setActiveService(service.id); resetForm(); }}
                >
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl ${service.color} flex items-center justify-center`}>
                      <service.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{service.title}</span>
                    <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{service.price}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Other Services */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">Other Services</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {otherServices.map((service) => (
                <Card
                  key={service.title}
                  className={`relative hover:shadow-card transition-all cursor-pointer ${service.route ? "" : "opacity-70"}`}
                  onClick={() => service.route ? navigate(service.route) : toast({ title: "Coming Soon", description: `${service.title} will be available soon!` })}
                >
                  {service.badge && (
                    <Badge className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 gradient-gold text-secondary-foreground border-0">{service.badge}</Badge>
                  )}
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl ${service.color} flex items-center justify-center`}>
                      <service.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{service.title}</span>
                    <Badge variant="outline" className={`text-[10px] ${service.route ? "border-primary/30 text-primary" : "text-muted-foreground"}`}>{service.route ? "Active" : "Soon"}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
      </div>
    </PageTransition>
  );
};

export default Verification;
