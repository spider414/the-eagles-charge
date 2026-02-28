import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bird,
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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

interface NinResult {
  full_name: string;
  first_name: string;
  middle_name: string;
  last_name: string;
  nin: string;
  gender: string;
  date_of_birth: string;
  photo: string | null;
}

const services = [
  {
    title: "NIN Verification",
    description: "Verify any NIN number instantly",
    icon: ShieldCheck,
    color: "bg-primary",
    status: "coming_soon" as const,
  },
  {
    title: "Retrieve NIN With Phone",
    description: "Look up NIN using phone number",
    icon: Phone,
    color: "bg-emerald-500",
    status: "active" as const,
    id: "nin-phone",
  },
  {
    title: "NIN Validation",
    description: "Validate NIN details and data",
    icon: FileSearch,
    color: "bg-teal-500",
    status: "coming_soon" as const,
  },
  {
    title: "NIN Demography",
    description: "Retrieve NIN demographic data",
    icon: Users,
    color: "bg-cyan-600",
    status: "coming_soon" as const,
  },
  {
    title: "Print NIN Slip",
    description: "Download and print NIN slip",
    icon: Printer,
    color: "bg-indigo-500",
    status: "coming_soon" as const,
  },
  {
    title: "BVN Verification",
    description: "Verify any BVN number",
    icon: CreditCard,
    color: "bg-blue-600",
    status: "coming_soon" as const,
  },
  {
    title: "BVN Retrieval with Phone",
    description: "Look up BVN using phone number",
    icon: Phone,
    color: "bg-sky-500",
    status: "coming_soon" as const,
  },
  {
    title: "Print BVN Slip",
    description: "Download and print BVN slip",
    icon: Printer,
    color: "bg-violet-500",
    status: "coming_soon" as const,
  },
  {
    title: "TIN Registration/Retrieval",
    description: "Register or retrieve your TIN",
    icon: FileText,
    color: "bg-orange-500",
    status: "coming_soon" as const,
  },
  {
    title: "CAC Registration",
    description: "Register your business with CAC",
    icon: Building2,
    color: "bg-amber-600",
    status: "coming_soon" as const,
  },
  {
    title: "SCUML Registration",
    description: "Register with SCUML for compliance",
    icon: FileText,
    color: "bg-rose-500",
    badge: "NEW",
    status: "coming_soon" as const,
  },
  {
    title: "IPE Clearance",
    description: "IPE clearance verification",
    icon: ShieldCheck,
    color: "bg-red-600",
    status: "coming_soon" as const,
  },
];

const Verification = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const { toast } = useToast();

  const [activeService, setActiveService] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [ninResult, setNinResult] = useState<NinResult | null>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  const handleNinPhoneLookup = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      toast({
        title: "Invalid Phone Number",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);
    setNinResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("verify-nin-phone", {
        body: { phone_number: phoneNumber },
      });

      if (error) throw error;

      if (data?.success) {
        setNinResult(data.data);
        toast({ title: "Success", description: "NIN retrieved successfully!" });
      } else {
        toast({
          title: "Verification Failed",
          description: data?.error || "No NIN found for this phone number",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Something went wrong. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
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
              <span className="text-sm font-semibold">
                ₦{profile?.wallet_balance?.toLocaleString() || "0.00"}
              </span>
            </div>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-6">
          {/* NIN Phone Lookup Panel */}
          {activeService === "nin-phone" && (
            <Card className="border-primary/20 shadow-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    Retrieve NIN With Phone
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setActiveService(null);
                      setNinResult(null);
                      setPhoneNumber("");
                    }}
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="e.g. 08012345678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    maxLength={15}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleNinPhoneLookup}
                  disabled={isVerifying || !phoneNumber}
                >
                  {isVerifying ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Retrieve NIN
                    </>
                  )}
                </Button>

                {/* Result */}
                {ninResult && (
                  <Card className="bg-accent/30 border-primary/20">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <CheckCircle2 className="h-5 w-5" />
                        NIN Retrieved Successfully
                      </div>
                      {ninResult.photo && (
                        <div className="flex justify-center">
                          <img
                            src={`data:image/jpeg;base64,${ninResult.photo}`}
                            alt="NIN Photo"
                            className="w-24 h-24 rounded-xl object-cover border-2 border-primary/20"
                          />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Full Name</p>
                          <p className="font-semibold">{ninResult.full_name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">NIN</p>
                          <p className="font-mono font-semibold">{ninResult.nin}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Gender</p>
                          <p className="font-semibold capitalize">{ninResult.gender}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Date of Birth</p>
                          <p className="font-semibold">{ninResult.date_of_birth}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          )}

          {/* Services Section */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">NIN Services</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.filter((s) => s.title.includes("NIN") || s.title.includes("IPE") || s.title === "Print NIN Slip").map((service) => (
                <Card
                  key={service.title}
                  className={`relative hover:shadow-card hover:border-primary/20 transition-all cursor-pointer ${
                    service.status === "coming_soon" ? "opacity-70" : ""
                  } ${activeService === service.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => {
                    if (service.status === "active" && service.id) {
                      setActiveService(service.id);
                      setNinResult(null);
                    } else {
                      toast({ title: "Coming Soon", description: `${service.title} will be available soon!` });
                    }
                  }}
                >
                  {service.badge && (
                    <Badge className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 gradient-gold text-secondary-foreground border-0">
                      {service.badge}
                    </Badge>
                  )}
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl ${service.color} flex items-center justify-center`}>
                      <service.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{service.title}</span>
                    {service.status === "active" ? (
                      <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Soon
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* BVN & Other Services */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-primary" />
              <h2 className="text-xl font-bold">BVN & Other Services</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {services.filter((s) => !s.title.includes("NIN") && !s.title.includes("IPE") && s.title !== "Print NIN Slip").map((service) => (
                <Card
                  key={service.title}
                  className="relative hover:shadow-card hover:border-primary/20 transition-all cursor-pointer opacity-70"
                  onClick={() =>
                    toast({ title: "Coming Soon", description: `${service.title} will be available soon!` })
                  }
                >
                  {service.badge && (
                    <Badge className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 gradient-gold text-secondary-foreground border-0">
                      {service.badge}
                    </Badge>
                  )}
                  <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 rounded-2xl ${service.color} flex items-center justify-center`}>
                      <service.icon className="h-6 w-6 text-white" />
                    </div>
                    <span className="text-xs font-semibold leading-tight">{service.title}</span>
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Soon
                    </Badge>
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
