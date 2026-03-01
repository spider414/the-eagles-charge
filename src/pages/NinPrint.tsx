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
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const sampleData: NinData = {
  full_name: "JOHN DOE SMITH",
  nin: "12345678901",
  gender: "Male",
  date_of_birth: "01-01-1990",
  phone: "08012345678",
  email: "john@example.com",
  state_of_origin: "Lagos",
  state_of_residence: "Abuja",
  nationality: "Nigerian",
  address: "123 Sample Street, Lagos",
};

const slipOptions: { value: SlipType; label: string; price: number; icon: typeof Star }[] = [
  { value: "premium", label: "Premium Slip", price: 700, icon: Award },
  { value: "standard", label: "Standard Slip", price: 600, icon: Star },
  { value: "regular", label: "Regular Slip", price: 500, icon: FileText },
];

const getSlipHtml = (content: string, title: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
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
`;

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

    // Check wallet balance
    const walletBalance = profile?.wallet_balance || 0;
    if (walletBalance < price) {
      toast({ title: "Insufficient Balance", description: `You need ₦${price} but have ₦${walletBalance.toLocaleString()}. Please top up your wallet.`, variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    setResult(null);

    try {
      // Debit wallet
      const { data: debitResult, error: debitError } = await supabase.rpc("debit_wallet", {
        p_profile_id: profile!.id,
        p_amount: price,
      });
      if (debitError) throw debitError;
      if (!debitResult?.[0]?.success) {
        toast({ title: "Insufficient Balance", description: "Failed to debit wallet.", variant: "destructive" });
        setIsVerifying(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("verify-nin", {
        body: { nin: ninNumber },
      });
      if (error) throw error;

      if (data?.success) {
        setResult(data.data);
        await supabase.from("transactions").insert({
          user_id: user!.id,
          transaction_type: "verification" as any,
          amount: price,
          status: "completed",
          data_plan: `nin-print-${slipType}`,
          api_response: data.data,
          phone_number: ninNumber,
        });
        toast({ title: "Verified!", description: "NIN verification successful. You can now print." });
      } else {
        await supabase.rpc("credit_wallet", { p_profile_id: profile!.id, p_amount: price });
        await supabase.from("transactions").insert({
          user_id: user!.id,
          transaction_type: "verification" as any,
          amount: price,
          status: "failed",
          data_plan: `nin-print-${slipType}`,
          api_response: { error: data?.error },
          phone_number: ninNumber,
        });
        toast({ title: "Failed", description: data?.error || "NIN verification failed. Wallet refunded.", variant: "destructive" });
      }
    } catch (err: any) {
      try { await supabase.rpc("credit_wallet", { p_profile_id: profile!.id, p_amount: price }); } catch {}
      toast({ title: "Error", description: err.message || "Something went wrong. Wallet refunded.", variant: "destructive" });
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(getSlipHtml(printRef.current.innerHTML, `NIN ${selectedSlip?.label || "Slip"}`));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadPdf = () => {
    if (!printRef.current) return;
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) return;
    pdfWindow.document.write(getSlipHtml(printRef.current.innerHTML, `NIN ${selectedSlip?.label || "Slip"}`));
    pdfWindow.document.close();
    setTimeout(() => pdfWindow.print(), 500);
    toast({ title: "Download PDF", description: "Select 'Save as PDF' in the print dialog to download." });
  };

  const photoSrc = result?.photo
    ? result.photo.startsWith("data:") ? result.photo : `data:image/jpeg;base64,${result.photo}`
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
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">NIN Verification</h1>
            <p className="text-sm text-muted-foreground">Choose the type of NIN slip you need for your verification</p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Select Slip Type
              </CardTitle>
              <p className="text-xs text-muted-foreground">Choose the type of NIN slip you need</p>
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

          {!result && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center font-medium">
                {slipType ? `Preview: ${selectedSlip?.label} format` : "Select a slip type to see preview"}
              </p>
              {slipType ? (
                <div className="relative">
                  <div className="opacity-70 pointer-events-none">
                    {slipType === "premium" ? (
                      <NinPremiumSlip data={sampleData} photoSrc={null} />
                    ) : slipType === "standard" ? (
                      <NinStandardSlip data={sampleData} photoSrc={null} />
                    ) : (
                      <NinRegularSlip data={sampleData} photoSrc={null} />
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-xl">
                    <div className="bg-background border border-border rounded-lg px-4 py-2 shadow-lg text-center">
                      <p className="text-xs font-semibold text-foreground">Sample Preview</p>
                      <p className="text-[10px] text-muted-foreground">Verify NIN to see actual data</p>
                    </div>
                  </div>
                </div>
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/20">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center text-muted-foreground">
                    <Printer className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm">Preview will appear here when you select a slip type</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Enter NIN Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nin">National Identity Number (NIN)</Label>
                <Input id="nin" type="text" placeholder="Enter 11-digit NIN" value={ninNumber} onChange={(e) => setNinNumber(e.target.value.replace(/\D/g, ""))} maxLength={11} />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <p><strong>Privacy Notice:</strong> Your NIN information is encrypted and securely processed. We never store your personal data after verification.</p>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
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

          {result && (
            <div className="space-y-5 animate-fade-in">
              {/* Download Options */}
              <Card className="text-center">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-lg font-bold text-foreground">
                    <Download className="h-5 w-5" />
                    Download Options
                  </div>
                  <p className="text-sm text-muted-foreground">Generate and download your verification slip in PDF format for official use.</p>
                  <div className="flex gap-3 justify-center">
                    <Button onClick={handleDownloadPdf} className="gap-2">
                      <FileText className="h-4 w-4" />Generate PDF Slip
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/verification")}>
                      <ArrowLeft className="h-4 w-4 mr-1" />Back to Dashboard
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Request Information Bar */}
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-3">
                  <div className="flex items-center gap-2 text-white text-xs font-semibold mb-1">
                    <FileText className="h-3.5 w-3.5" />
                    Request Information
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-white text-[11px]">
                    <span>📅 Date: {new Date().toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span>💰 Amount: ₦{price.toFixed(2)}</span>
                    <span>⚙️ Service: NIN Print</span>
                    <span>📄 Slip Type: {selectedSlip?.label || "Regular"}</span>
                  </div>
                </div>
              </Card>

              {/* Verification Details */}
              <Card>
                <CardHeader className="pb-0">
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 -mx-6 -mt-6 px-5 py-3 rounded-t-lg">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Verification Details
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  {/* Photograph */}
                  {photoSrc && (
                    <div className="text-center space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1">📷 Photograph</p>
                      <img
                        src={photoSrc}
                        alt="NIN Photo"
                        className="mx-auto w-32 h-40 object-cover rounded-lg border-2 border-border shadow-sm"
                      />
                    </div>
                  )}

                  {/* Personal Information */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                      👤 Personal Information
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <InfoField label="FIRST NAME" value={result.first_name || result.full_name?.split(" ")[0]} />
                      <InfoField label="LAST NAME" value={result.last_name || result.full_name?.split(" ").slice(-1)[0]} />
                      <InfoField label="GENDER" value={result.gender} />
                      <InfoField label="DATE OF BIRTH" value={result.date_of_birth} />
                      {result.middle_name && <InfoField label="MIDDLE NAME" value={result.middle_name} />}
                    </div>
                  </div>

                  <Separator />

                  {/* Contact Information */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                      📞 Contact Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {result.phone && <InfoField label="PHONE NUMBER" value={result.phone} />}
                      {result.email && <InfoField label="EMAIL" value={result.email} />}
                    </div>
                  </div>

                  <Separator />

                  {/* Address Information */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                      📍 Address Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {result.address && <InfoField label="RESIDENTIAL ADDRESS" value={result.address} fullWidth />}
                      {result.nationality && <InfoField label="COUNTRY OF BIRTH" value={result.nationality} />}
                      {result.state_of_residence && <InfoField label="STATE OF RESIDENCE" value={result.state_of_residence} />}
                    </div>
                  </div>

                  <Separator />

                  {/* Identity Information */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
                      🪪 Identity Information
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <InfoField label="NIN" value={result.nin} />
                      {result.state_of_origin && <InfoField label="STATE OF ORIGIN" value={result.state_of_origin} />}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Hidden print container with formatted slip */}
              <div ref={printRef} className="hidden">
                {slipType === "premium" ? (
                  <NinPremiumSlip data={result} photoSrc={photoSrc} />
                ) : slipType === "standard" ? (
                  <NinStandardSlip data={result} photoSrc={photoSrc} />
                ) : (
                  <NinRegularSlip data={result} photoSrc={photoSrc} />
                )}
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />Print Slip
                </Button>
                <Button variant="outline" className="w-full" onClick={handleDownloadPdf}>
                  <Download className="h-4 w-4 mr-2" />Save as PDF
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
};

/* ─── Premium Slip (₦700) ─── */
const NinPremiumSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "420px", margin: "0 auto",
    background: "linear-gradient(135deg, #0a4d27 0%, #063d1e 40%, #0a6b35 100%)",
    borderRadius: "16px", padding: "24px", color: "white", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25)", position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%) rotate(-30deg)", fontSize: "80px", opacity: 0.03, fontWeight: "bold", whiteSpace: "nowrap" }}>NIMC</div>
    <div style={{ textAlign: "center", marginBottom: "16px", borderBottom: "2px solid rgba(255,255,255,0.2)", paddingBottom: "12px" }}>
      <div style={{ fontSize: "9px", letterSpacing: "3px", opacity: 0.8, textTransform: "uppercase" }}>Federal Republic of Nigeria</div>
      <div style={{ fontSize: "17px", fontWeight: "bold", marginTop: "4px", letterSpacing: "1px" }}>NATIONAL IDENTITY NUMBER</div>
      <div style={{ fontSize: "9px", opacity: 0.6, marginTop: "2px" }}>National Identity Management Commission (NIMC)</div>
      <div style={{ display: "inline-block", background: "rgba(255,215,0,0.2)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "4px", padding: "2px 8px", marginTop: "6px", fontSize: "8px", color: "#ffd700", letterSpacing: "2px" }}>PREMIUM</div>
    </div>
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
    <div style={{ marginTop: "14px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "10px", fontSize: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
      {data.phone && <div><span style={{ opacity: 0.6 }}>Phone:</span> {data.phone}</div>}
      {data.email && <div><span style={{ opacity: 0.6 }}>Email:</span> {data.email}</div>}
      {data.state_of_origin && <div><span style={{ opacity: 0.6 }}>State:</span> {data.state_of_origin}</div>}
      {data.nationality && <div><span style={{ opacity: 0.6 }}>Nationality:</span> {data.nationality}</div>}
      {data.address && <div style={{ gridColumn: "1 / -1" }}><span style={{ opacity: 0.6 }}>Address:</span> {data.address}</div>}
    </div>
    <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px", textAlign: "center", fontSize: "8px", opacity: 0.5 }}>
      Powered by THE EAGLES VTU • For verification purposes only
    </div>
  </div>
);

/* ─── Standard Slip (₦600) ─── */
const NinStandardSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "480px", margin: "0 auto",
    background: "white", border: "2px solid #0a4d27",
    borderRadius: "10px", padding: "24px", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
  }}>
    <div style={{ textAlign: "center", borderBottom: "2px solid #0a4d27", paddingBottom: "12px", marginBottom: "16px" }}>
      <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#666", textTransform: "uppercase" }}>Federal Republic of Nigeria</div>
      <div style={{ fontSize: "17px", fontWeight: "bold", color: "#0a4d27", marginTop: "4px" }}>NIN VERIFICATION SLIP</div>
      <div style={{ fontSize: "9px", color: "#999", marginTop: "2px" }}>National Identity Management Commission</div>
      <div style={{ display: "inline-block", background: "#f0f7f3", border: "1px solid #0a4d27", borderRadius: "4px", padding: "2px 8px", marginTop: "6px", fontSize: "8px", color: "#0a4d27", letterSpacing: "1px" }}>STANDARD</div>
    </div>
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
            {([
              ["Full Name", data.full_name], ["NIN", data.nin], ["Gender", data.gender],
              ["Date of Birth", data.date_of_birth], ["Phone", data.phone], ["Email", data.email],
              ["State of Origin", data.state_of_origin || data.state], ["Nationality", data.nationality], ["Address", data.address],
            ] as [string, string | undefined][]).filter(([, val]) => val).map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: "3px 8px 3px 0", color: "#666", whiteSpace: "nowrap", verticalAlign: "top", fontSize: "11px" }}>{label}:</td>
                <td style={{ padding: "3px 0", fontWeight: "600", textTransform: label === "Gender" ? "capitalize" : "none" }}>{value}</td>
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

/* ─── Regular Slip (₦500) ─── */
const NinRegularSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "440px", margin: "0 auto",
    background: "white", border: "1px solid #ddd",
    borderRadius: "8px", padding: "20px", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
  }}>
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
