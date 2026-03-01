import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Printer,
  Wallet,
  Clock,
  CheckCircle2,
  ShieldCheck,
  FileText,
  Award,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

type SlipType = "premium" | "standard" | "regular";

interface NinData {
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  nin?: string;
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

const slipOptions: { value: SlipType; label: string; price: number; icon: typeof Star }[] = [
  { value: "premium", label: "Premium Slip", price: 450, icon: Award },
  { value: "standard", label: "Standard Slip", price: 400, icon: Star },
  { value: "regular", label: "Regular Slip", price: 350, icon: FileText },
];

const NinPrint = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [slipType, setSlipType] = useState<SlipType | "">("");
  const [ninNumber, setNinNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<NinData | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  const selectedSlip = slipOptions.find((s) => s.value === slipType);
  const price = selectedSlip?.price || 0;

  const handleVerify = async () => {
    if (!slipType) {
      toast({ title: "Select Slip Type", description: "Please select a slip type first", variant: "destructive" });
      return;
    }
    if (!ninNumber || ninNumber.replace(/\D/g, "").length !== 11) {
      toast({ title: "Invalid NIN", description: "NIN must be exactly 11 digits", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Consent Required", description: "Please confirm you have obtained proper consent", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("verify-nin", {
        body: { nin: ninNumber },
      });
      if (error) throw error;

      if (data?.success) {
        setResult(data.data);
        toast({ title: "Verified!", description: "NIN verification successful. You can now print." });
      } else {
        toast({ title: "Failed", description: data?.error || "NIN verification failed", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = printRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>NIN ${selectedSlip?.label || "Slip"}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
          .print-container { background: white; }
          @media print {
            body { background: white; }
            .print-container { box-shadow: none !important; }
          }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const photoSrc = result?.photo
    ? result.photo.startsWith("data:")
      ? result.photo
      : `data:image/jpeg;base64,${result.photo}`
    : null;

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
              <Button variant="ghost" size="icon" onClick={() => navigate("/verification")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-gold shadow-gold">
                  <Printer className="h-5 w-5 text-secondary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">Print NIN</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
            </div>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-6 max-w-lg mx-auto">
          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">NIN Verification</h1>
            <p className="text-sm text-muted-foreground">Choose the type of NIN slip you need for your verification</p>
          </div>

          {/* Slip Type Selection */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Select Slip Type
              </CardTitle>
              <p className="text-xs text-muted-foreground">Choose the type of NIN slip you need for your verification</p>
            </CardHeader>
            <CardContent>
              <Select value={slipType} onValueChange={(v) => setSlipType(v as SlipType)}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Select a slip type --" />
                </SelectTrigger>
                <SelectContent>
                  {slipOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className="flex items-center gap-2">
                        <opt.icon className="h-4 w-4" /> {opt.label} - ₦{opt.price.toFixed(2)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Preview Area (before verification) */}
          {!result && (
            <Card className="border-dashed border-2 border-muted-foreground/20">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                <Printer className="h-10 w-10 mb-3 opacity-30" />
                <p className="text-sm">Preview will appear here when you verify a NIN</p>
              </CardContent>
            </Card>
          )}

          {/* NIN Input */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Enter NIN Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nin">National Identity Number (NIN)</Label>
                <Input
                  id="nin"
                  type="text"
                  placeholder="Enter 11-digit NIN"
                  value={ninNumber}
                  onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, ""))}
                  maxLength={11}
                />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <p>
                  <strong>Privacy Notice:</strong> Your NIN information is encrypted and securely processed.
                  We never store your personal data after verification.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(checked) => setConsent(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  I confirm that I have obtained proper consent from the NIN owner for this verification.
                </Label>
              </div>

              <Button className="w-full" onClick={handleVerify} disabled={isVerifying || !slipType}>
                {isVerifying ? (
                  <><Clock className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-2" />Verify & Generate Slip - ₦{price}</>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Result & Print Preview */}
          {result && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                NIN Verified Successfully
              </div>

              {/* Printable Content */}
              <div ref={printRef}>
                {slipType === "premium" ? (
                  <NinPremiumSlip data={result} photoSrc={photoSrc} />
                ) : slipType === "standard" ? (
                  <NinStandardSlip data={result} photoSrc={photoSrc} />
                ) : (
                  <NinRegularSlip data={result} photoSrc={photoSrc} />
                )}
              </div>

              <Button className="w-full" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print NIN {selectedSlip?.label}
              </Button>
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
};

/* ─── Premium Slip (₦450) - Full color ID card style ─── */
const NinPremiumSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "420px", margin: "0 auto",
    background: "linear-gradient(135deg, #0a4d27 0%, #063d1e 40%, #0a6b35 100%)",
    borderRadius: "16px", padding: "24px", color: "white", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)", position: "relative", overflow: "hidden",
  }}>
    {/* Watermark */}
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-30deg)", fontSize: "80px", opacity: 0.03, fontWeight: "bold", whiteSpace: "nowrap" }}>NIMC</div>
    
    {/* Header */}
    <div style={{ textAlign: "center", marginBottom: "16px", borderBottom: "2px solid rgba(255,255,255,0.2)", paddingBottom: "12px" }}>
      <div style={{ fontSize: "9px", letterSpacing: "3px", opacity: 0.8, textTransform: "uppercase" }}>Federal Republic of Nigeria</div>
      <div style={{ fontSize: "17px", fontWeight: "bold", marginTop: "4px", letterSpacing: "1px" }}>NATIONAL IDENTITY NUMBER</div>
      <div style={{ fontSize: "9px", opacity: 0.6, marginTop: "2px" }}>National Identity Management Commission (NIMC)</div>
      <div style={{ display: "inline-block", background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "4px", padding: "2px 8px", marginTop: "6px", fontSize: "8px", color: "#ffd700", letterSpacing: "2px" }}>PREMIUM</div>
    </div>

    {/* Photo + Info */}
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      {photoSrc ? (
        <img src={photoSrc} alt="NIN Photo" style={{ width: "95px", height: "115px", objectFit: "cover", borderRadius: "8px", border: "2px solid rgba(255,255,255,0.3)" }} />
      ) : (
        <div style={{ width: "95px", height: "115px", background: "rgba(255,255,255,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", opacity: 0.5 }}>No Photo</div>
      )}
      <div style={{ flex: 1, fontSize: "11px", lineHeight: "1.7" }}>
        <div><span style={{ opacity: 0.6 }}>Full Name:</span><br /><strong>{data.full_name || "N/A"}</strong></div>
        <div style={{ marginTop: "4px" }}><span style={{ opacity: 0.6 }}>NIN:</span><br /><strong style={{ letterSpacing: "2px", fontSize: "13px" }}>{data.nin || "N/A"}</strong></div>
        <div style={{ marginTop: "4px" }}><span style={{ opacity: 0.6 }}>Gender:</span> <strong style={{ textTransform: "capitalize" }}>{data.gender || "N/A"}</strong></div>
        <div><span style={{ opacity: 0.6 }}>DOB:</span> <strong>{data.date_of_birth || "N/A"}</strong></div>
      </div>
    </div>

    {/* Additional Details */}
    <div style={{ marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "10px", fontSize: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
      {data.phone && <div><span style={{ opacity: 0.6 }}>Phone:</span> {data.phone}</div>}
      {data.email && <div><span style={{ opacity: 0.6 }}>Email:</span> {data.email}</div>}
      {data.state_of_origin && <div><span style={{ opacity: 0.6 }}>State:</span> {data.state_of_origin}</div>}
      {data.nationality && <div><span style={{ opacity: 0.6 }}>Nationality:</span> {data.nationality}</div>}
      {data.address && <div style={{ gridColumn: "1 / -1" }}><span style={{ opacity: 0.6 }}>Address:</span> {data.address}</div>}
    </div>

    {/* Footer */}
    <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px", textAlign: "center", fontSize: "8px", opacity: 0.5 }}>
      Powered by THE EAGLES VTU • For verification purposes only
    </div>
  </div>
);

/* ─── Standard Slip (₦400) - Clean bordered format ─── */
const NinStandardSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "480px", margin: "0 auto",
    background: "white", border: "2px solid #0a4d27",
    borderRadius: "10px", padding: "24px", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  }}>
    {/* Header */}
    <div style={{ textAlign: "center", borderBottom: "2px solid #0a4d27", paddingBottom: "12px", marginBottom: "16px" }}>
      <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#666", textTransform: "uppercase" }}>Federal Republic of Nigeria</div>
      <div style={{ fontSize: "17px", fontWeight: "bold", color: "#0a4d27", marginTop: "4px" }}>NIN VERIFICATION SLIP</div>
      <div style={{ fontSize: "9px", color: "#999", marginTop: "2px" }}>National Identity Management Commission</div>
      <div style={{ display: "inline-block", background: "#f0f7f3", border: "1px solid #0a4d27", borderRadius: "4px", padding: "2px 8px", marginTop: "6px", fontSize: "8px", color: "#0a4d27", letterSpacing: "1px" }}>STANDARD</div>
    </div>

    {/* Content */}
    <div style={{ display: "flex", gap: "20px" }}>
      <div style={{ flexShrink: 0 }}>
        {photoSrc ? (
          <img src={photoSrc} alt="NIN Photo" style={{ width: "100px", height: "120px", objectFit: "cover", border: "2px solid #0a4d27", borderRadius: "6px" }} />
        ) : (
          <div style={{ width: "100px", height: "120px", background: "#f0f0f0", border: "2px solid #ccc", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#999" }}>No Photo</div>
        )}
      </div>

      <div style={{ flex: 1 }}>
        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
          <tbody>
            {[
              ["Full Name", data.full_name],
              ["NIN", data.nin],
              ["Gender", data.gender],
              ["Date of Birth", data.date_of_birth],
              ["Phone", data.phone],
              ["Email", data.email],
              ["State of Origin", data.state_of_origin || data.state],
              ["Nationality", data.nationality],
              ["Address", data.address],
            ].filter(([, val]) => val).map(([label, value]) => (
              <tr key={label as string}>
                <td style={{ padding: "3px 8px 3px 0", color: "#666", whiteSpace: "nowrap", verticalAlign: "top", fontSize: "11px" }}>{label}:</td>
                <td style={{ padding: "3px 0", fontWeight: "600", textTransform: label === "Gender" ? "capitalize" : "none" }}>{value as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <div style={{ marginTop: "16px", borderTop: "1px solid #ddd", paddingTop: "8px", textAlign: "center", fontSize: "8px", color: "#999" }}>
      This slip is generated for verification purposes only. • Powered by THE EAGLES VTU
    </div>
  </div>
);

/* ─── Regular Slip (₦350) - Simple compact format ─── */
const NinRegularSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "440px", margin: "0 auto",
    background: "white", border: "1px solid #ddd",
    borderRadius: "8px", padding: "20px", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  }}>
    {/* Header */}
    <div style={{ textAlign: "center", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "14px" }}>
      <div style={{ fontSize: "14px", fontWeight: "bold", color: "#333" }}>NIN VERIFICATION</div>
      <div style={{ fontSize: "9px", color: "#999", marginTop: "2px" }}>National Identity Management Commission</div>
    </div>

    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      {photoSrc ? (
        <img src={photoSrc} alt="NIN Photo" style={{ width: "80px", height: "100px", objectFit: "cover", border: "1px solid #ddd", borderRadius: "4px" }} />
      ) : (
        <div style={{ width: "80px", height: "100px", background: "#f5f5f5", border: "1px solid #ddd", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#bbb" }}>No Photo</div>
      )}
      <div style={{ flex: 1, fontSize: "11px", lineHeight: "1.8" }}>
        <div><strong>{data.full_name || "N/A"}</strong></div>
        <div style={{ color: "#666" }}>NIN: <strong>{data.nin || "N/A"}</strong></div>
        <div style={{ color: "#666" }}>Gender: <span style={{ textTransform: "capitalize" }}>{data.gender || "N/A"}</span></div>
        <div style={{ color: "#666" }}>DOB: {data.date_of_birth || "N/A"}</div>
        {data.phone && <div style={{ color: "#666" }}>Phone: {data.phone}</div>}
        {(data.state_of_origin || data.state) && <div style={{ color: "#666" }}>State: {data.state_of_origin || data.state}</div>}
      </div>
    </div>

    <div style={{ marginTop: "12px", borderTop: "1px solid #eee", paddingTop: "6px", textAlign: "center", fontSize: "8px", color: "#bbb" }}>
      Powered by THE EAGLES VTU
    </div>
  </div>
);

export default NinPrint;
