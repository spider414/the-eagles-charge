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
import { Separator } from "@/components/ui/separator";
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
  { value: "premium", label: "Premium Slip", price: 450, icon: Award },
  { value: "standard", label: "Standard Slip", price: 400, icon: Star },
  { value: "regular", label: "Regular Slip", price: 350, icon: FileText },
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
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [slipType, setSlipType] = useState<SlipType | "">("");
  const [ninNumber, setNinNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<NinData | null>(null);
  const lastLookupRef = useRef<Record<string, number>>({});

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

    // Client-side rate limit: 60 seconds per NIN
    const cleanNin = ninNumber.replace(/\D/g, "");
    const lastTime = lastLookupRef.current[cleanNin];
    if (lastTime) {
      const elapsed = Math.floor((Date.now() - lastTime) / 1000);
      if (elapsed < 60) {
        toast({ title: "Please Wait", description: `You recently looked up this NIN. Try again in ${60 - elapsed} seconds.`, variant: "destructive" });
        return;
      }
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
      // Debit wallet via edge function (has service_role permissions)
      const { data: paymentData, error: paymentError } = await supabase.functions.invoke("paystack-payment", {
        body: {
          action: "wallet_payment",
          amount: price,
          metadata: {
            transaction_type: "verification",
            phone_number: ninNumber,
          },
        },
      });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) {
        toast({ title: "Insufficient Balance", description: paymentData?.error || "Failed to debit wallet.", variant: "destructive" });
        setIsVerifying(false);
        return;
      }

      // Record lookup timestamp for rate limiting
      lastLookupRef.current[cleanNin] = Date.now();

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
          balance_before: paymentData.balance_before,
          balance_after: paymentData.balance_after,
          description: `Payment for NIN Print (${selectedSlip?.label || slipType})`,
        });
        await refreshProfile();
        toast({ title: "Verified!", description: "NIN verification successful. You can now print." });
      } else {
        // Refund via edge function
        await supabase.functions.invoke("paystack-payment", {
          body: { action: "credit_wallet", amount: price },
        });
        await supabase.from("transactions").insert({
          user_id: user!.id,
          transaction_type: "verification" as any,
          amount: price,
          status: "failed",
          data_plan: `nin-print-${slipType}`,
          api_response: { error: data?.error },
          phone_number: ninNumber,
        });
        await refreshProfile();
        const errorMsg = data?.error || "NIN verification failed.";
        const isRateLimit = errorMsg.toLowerCase().includes("recent") || errorMsg.toLowerCase().includes("try again");
        toast({ 
          title: isRateLimit ? "Please Wait" : "Failed", 
          description: `${errorMsg} Your ₦${price} has been refunded.`, 
          variant: "destructive" 
        });
      }
    } catch (err: any) {
      try {
        await supabase.functions.invoke("paystack-payment", {
          body: { action: "credit_wallet", amount: price },
        });
      } catch {}
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
            <div className="space-y-3">
              {slipType ? (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">
                      {selectedSlip?.label} Preview
                    </p>
                    <span className="text-xs bg-primary/10 text-primary font-medium px-2.5 py-1 rounded-full">
                      Sample
                    </span>
                  </div>
                  <div className="relative rounded-2xl border-2 border-dashed border-primary/20 bg-muted/30 p-6 overflow-hidden">
                    <div className="opacity-60 pointer-events-none scale-[0.92] origin-center transition-transform">
                      {slipType === "premium" ? (
                        <NinPremiumSlip data={sampleData} photoSrc={null} />
                      ) : slipType === "standard" ? (
                        <NinStandardSlip data={sampleData} photoSrc={null} />
                      ) : (
                        <NinRegularSlip data={sampleData} photoSrc={null} />
                      )}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background/70 via-background/30 to-background/70 backdrop-blur-[1.5px]">
                      <div className="bg-background/95 border border-border/80 rounded-xl px-5 py-3 shadow-xl text-center space-y-1">
                        <ShieldCheck className="h-5 w-5 text-primary mx-auto" />
                        <p className="text-sm font-semibold text-foreground">Sample Preview</p>
                        <p className="text-[11px] text-muted-foreground">Enter your NIN & verify to see actual data</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    <span>Service Fee: <strong className="text-foreground">₦{price.toFixed(2)}</strong></span>
                  </div>
                </>
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/20">
                  <CardContent className="p-10 flex flex-col items-center justify-center text-center text-muted-foreground gap-3">
                    <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                      <Printer className="h-7 w-7 opacity-40" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">No slip type selected</p>
                      <p className="text-xs mt-0.5">Choose a format above to preview the layout</p>
                    </div>
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

/* ─── Premium Slip (₦450) — Digital NIN Card Style ─── */
const NinPremiumSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => {
  const surname = data.last_name || data.full_name?.split(" ").slice(-1)[0] || "RESIDENT";
  const givenNames = data.first_name
    ? `${data.first_name}${data.middle_name ? ", " + data.middle_name : ""}`
    : data.full_name?.split(" ").slice(0, -1).join(", ") || "PROUD, NIGERIAN";
  const dob = data.date_of_birth || "01 JAN 1990";
  const gender = data.gender?.charAt(0).toUpperCase() || "M";
  const nin = data.nin || "0000 000 0000";
  const formattedNin = nin.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3");

  return (
    <div className="print-container" style={{
      width: "100%", maxWidth: "480px", margin: "0 auto",
      background: "linear-gradient(145deg, #f0f7f0 0%, #e8f5e8 30%, #f5f9f5 60%, #eef6ee 100%)",
      borderRadius: "12px", padding: "0", fontFamily: "'Segoe UI', sans-serif",
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)", position: "relative", overflow: "hidden",
      border: "1px solid #c5dfc5",
    }}>
      {/* Watermark pattern */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 20px, #0a4d27 20px, #0a4d27 21px)", pointerEvents: "none" }} />

      {/* Header */}
      <div style={{ textAlign: "center", padding: "16px 20px 10px", position: "relative" }}>
        <div style={{ fontSize: "11px", color: "#0a4d27", fontWeight: "bold", letterSpacing: "1px" }}>FEDERAL REPUBLIC OF NIGERIA</div>
        <div style={{ fontSize: "14px", fontWeight: "bold", color: "#1a1a1a", marginTop: "2px" }}>DIGITAL NIN SLIP</div>
      </div>

      {/* Card body */}
      <div style={{ padding: "0 24px 10px", display: "flex", gap: "16px", position: "relative" }}>
        {/* Photo */}
        <div style={{ flexShrink: 0 }}>
          {photoSrc ? (
            <img src={photoSrc} alt="Photo" style={{ width: "90px", height: "110px", objectFit: "cover", borderRadius: "6px", border: "2px solid #b5d5b5" }} />
          ) : (
            <div style={{ width: "90px", height: "110px", background: "#d4e8d4", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #b5d5b5" }}>
              <div style={{ fontSize: "9px", color: "#666", textAlign: "center" }}>Photo</div>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, fontSize: "10px", color: "#333" }}>
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Surname/Nom</div>
            <div style={{ fontWeight: "bold", fontSize: "12px" }}>{surname.toUpperCase()}</div>
          </div>
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Given Names/Prénoms</div>
            <div style={{ fontWeight: "bold", fontSize: "11px" }}>{givenNames.toUpperCase()}</div>
          </div>
          <div>
            <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Date of Birth</div>
            <div style={{ fontWeight: "bold", fontSize: "11px" }}>{dob}</div>
          </div>
        </div>

        {/* Right side - NGA + QR placeholder */}
        <div style={{ flexShrink: 0, textAlign: "center", width: "80px" }}>
          <div style={{ fontWeight: "bold", fontSize: "18px", color: "#333", marginBottom: "4px" }}>NGA</div>
          <div style={{ width: "60px", height: "60px", margin: "0 auto", background: "#ddd", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "7px", color: "#999" }}>QR Code</div>
          </div>
          <div style={{ marginTop: "4px", fontSize: "7px", color: "#666" }}>ISSUE DATE</div>
          <div style={{ fontSize: "8px", fontWeight: "bold", color: "#333" }}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
        </div>
      </div>

      {/* NIN display */}
      <div style={{ textAlign: "center", padding: "10px 20px 6px" }}>
        <div style={{ fontSize: "9px", color: "#666" }}>National Identification Number (NIN)</div>
        <div style={{ fontSize: "28px", fontWeight: "bold", color: "#1a1a1a", letterSpacing: "4px", fontFamily: "'Courier New', monospace" }}>{formattedNin}</div>
      </div>

      {/* Green bar at bottom */}
      <div style={{ background: "linear-gradient(90deg, #0a6b35, #15a35c)", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 0 12px 12px" }}>
        <span style={{ fontSize: "8px", color: "white", opacity: 0.8 }}>Powered by THE EAGLES VTU • For verification purposes only</span>
      </div>
    </div>
  );
};

/* ─── Standard Slip (₦400) — NIN Card with Coat of Arms ─── */
const NinStandardSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => {
  const surname = data.last_name || data.full_name?.split(" ").slice(-1)[0] || "RESIDENT";
  const givenNames = data.first_name
    ? `${data.first_name}${data.middle_name ? ", " + data.middle_name : ""}`
    : data.full_name?.split(" ").slice(0, -1).join(", ") || "PROUD, NIGERIAN";
  const dob = data.date_of_birth || "01 OCT 1960";
  const nin = data.nin || "0000 000 0000";
  const formattedNin = nin.replace(/(\d{4})(\d{3})(\d{4})/, "$1 $2 $3");

  return (
    <div className="print-container" style={{
      width: "100%", maxWidth: "480px", margin: "0 auto",
      background: "linear-gradient(160deg, #fafdf8 0%, #f0f5ec 50%, #f8faf6 100%)",
      borderRadius: "12px", fontFamily: "'Segoe UI', sans-serif",
      boxShadow: "0 6px 24px rgba(0,0,0,0.12)", position: "relative", overflow: "hidden",
      border: "1px solid #d5e5d0",
    }}>
      {/* Watermark */}
      <div style={{ position: "absolute", inset: 0, opacity: 0.03, backgroundImage: "repeating-linear-gradient(-45deg, transparent, transparent 25px, #0a4d27 25px, #0a4d27 26px)", pointerEvents: "none" }} />

      {/* Coat of arms header */}
      <div style={{ textAlign: "center", padding: "16px 20px 8px", position: "relative" }}>
        <div style={{ fontSize: "24px", marginBottom: "2px" }}>🇳🇬</div>
        <div style={{ marginBottom: "6px" }}>
          <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Surname/Nom</div>
          <div style={{ fontWeight: "bold", fontSize: "13px", color: "#333" }}>{surname.toUpperCase()}</div>
        </div>
      </div>

      <div style={{ padding: "0 24px", display: "flex", gap: "16px", position: "relative" }}>
        <div style={{ flexShrink: 0 }}>
          {photoSrc ? (
            <img src={photoSrc} alt="Photo" style={{ width: "85px", height: "105px", objectFit: "cover", borderRadius: "6px", border: "2px solid #c5dfc5" }} />
          ) : (
            <div style={{ width: "85px", height: "105px", background: "#e0ede0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #c5dfc5" }}>
              <div style={{ fontSize: "9px", color: "#888" }}>Photo</div>
            </div>
          )}
        </div>
        <div style={{ flex: 1, fontSize: "10px" }}>
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Given Names/Prénoms</div>
            <div style={{ fontWeight: "bold", fontSize: "11px", color: "#333" }}>{givenNames.toUpperCase()}</div>
          </div>
          <div style={{ marginBottom: "6px" }}>
            <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Date of Birth</div>
            <div style={{ fontWeight: "bold", fontSize: "11px", color: "#333" }}>{dob}</div>
          </div>
          {data.gender && (
            <div>
              <div style={{ fontSize: "8px", color: "#0a6b35", fontStyle: "italic" }}>Sex/Sexe</div>
              <div style={{ fontWeight: "bold", fontSize: "11px", color: "#333" }}>{data.gender.charAt(0).toUpperCase()}</div>
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, textAlign: "center", width: "70px" }}>
          <div style={{ fontWeight: "bold", fontSize: "16px", color: "#333", marginBottom: "4px" }}>NGA</div>
          <div style={{ width: "55px", height: "55px", margin: "0 auto", background: "#e8e8e8", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: "7px", color: "#aaa" }}>QR Code</div>
          </div>
          <div style={{ marginTop: "4px", fontSize: "7px", color: "#666" }}>ISSUE DATE</div>
          <div style={{ fontSize: "8px", fontWeight: "bold" }}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</div>
        </div>
      </div>

      <div style={{ textAlign: "center", padding: "12px 20px 6px" }}>
        <div style={{ fontSize: "9px", color: "#666" }}>National Identification Number (NIN)</div>
        <div style={{ fontSize: "26px", fontWeight: "bold", color: "#1a1a1a", letterSpacing: "4px", fontFamily: "'Courier New', monospace" }}>{formattedNin}</div>
      </div>

      <div style={{ background: "linear-gradient(90deg, #0a8a4a, #20c070)", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "0 0 12px 12px" }}>
        <span style={{ fontSize: "8px", color: "white", opacity: 0.8 }}>Powered by THE EAGLES VTU</span>
      </div>
    </div>
  );
};

/* ─── Regular Slip (₦350) — Official NIMC Table Format ─── */
const NinRegularSlip = ({ data, photoSrc }: { data: NinData; photoSrc: string | null }) => {
  const surname = data.last_name || data.full_name?.split(" ").slice(-1)[0] || "N/A";
  const firstName = data.first_name || data.full_name?.split(" ")[0] || "N/A";
  const middleName = data.middle_name || data.full_name?.split(" ").slice(1, -1).join(" ") || "";
  const nin = data.nin || "00000000000";

  return (
    <div className="print-container" style={{
      width: "100%", maxWidth: "520px", margin: "0 auto",
      background: "linear-gradient(160deg, #fffef8 0%, #fefcf0 100%)",
      borderRadius: "8px", fontFamily: "'Segoe UI', sans-serif",
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)", overflow: "hidden",
      border: "1px solid #e0d8c0",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", padding: "12px 16px 8px", borderBottom: "2px solid #0a4d27" }}>
        <div style={{ fontSize: "24px", marginBottom: "2px" }}>🇳🇬</div>
        <div style={{ fontSize: "13px", fontWeight: "bold", color: "#0a4d27" }}>National Identity Management System</div>
        <div style={{ fontSize: "10px", color: "#555" }}>Federal Republic of Nigeria</div>
        <div style={{ fontSize: "9px", color: "#888", marginTop: "2px" }}>National Identification Number Slip (NINS)</div>
      </div>

      {/* Table layout body */}
      <div style={{ padding: "12px 16px", display: "flex", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", border: "1px solid #ccc" }}>
            <tbody>
              <tr>
                <td style={{ ...cellStyle, color: "#666", width: "35%" }}>Tracking ID</td>
                <td style={{ ...cellStyle, fontWeight: "600", fontSize: "9px" }}>EAGLES{Date.now().toString().slice(-8)}</td>
              </tr>
              <tr>
                <td style={{ ...cellStyle, color: "#666" }}>NIN</td>
                <td style={{ ...cellStyle, fontWeight: "bold", color: "#c00" }}>
                  <span style={{ border: "1px solid #c00", borderRadius: "8px", padding: "1px 6px", fontSize: "10px" }}>{nin}</span>
                </td>
              </tr>
              <tr>
                <td style={{ ...cellStyle, color: "#666" }}>Issue Date</td>
                <td style={{ ...cellStyle, fontWeight: "600" }}>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" })}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ flex: 1 }}>
          <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse", border: "1px solid #ccc" }}>
            <tbody>
              <tr>
                <td style={{ ...cellStyle, color: "#666", width: "40%" }}>Surname</td>
                <td style={{ ...cellStyle, fontWeight: "600" }}>{surname.toUpperCase()}</td>
              </tr>
              <tr>
                <td style={{ ...cellStyle, color: "#666" }}>First Name</td>
                <td style={{ ...cellStyle, fontWeight: "600" }}>{firstName.toUpperCase()}</td>
              </tr>
              <tr>
                <td style={{ ...cellStyle, color: "#666" }}>Middle Name</td>
                <td style={{ ...cellStyle, fontWeight: "600" }}>{middleName.toUpperCase() || "—"}</td>
              </tr>
              <tr>
                <td style={{ ...cellStyle, color: "#666" }}>Gender</td>
                <td style={{ ...cellStyle, fontWeight: "600", textTransform: "capitalize" }}>{data.gender?.charAt(0).toUpperCase() || "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Photo + NIMC badge */}
        <div style={{ flexShrink: 0, textAlign: "center", width: "80px" }}>
          <div style={{ fontSize: "8px", color: "#0a6b35", fontWeight: "bold", marginBottom: "4px" }}>NIMC</div>
          {photoSrc ? (
            <img src={photoSrc} alt="Photo" style={{ width: "75px", height: "95px", objectFit: "cover", borderRadius: "4px", border: "1px solid #ccc" }} />
          ) : (
            <div style={{ width: "75px", height: "95px", background: "#f0ece0", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #ccc" }}>
              <div style={{ fontSize: "8px", color: "#999" }}>Photo</div>
            </div>
          )}
          {data.address && (
            <div style={{ marginTop: "4px", fontSize: "7px", color: "#666", textAlign: "left" }}>
              <div style={{ fontWeight: "bold" }}>Address:</div>
              <div>{data.address}</div>
            </div>
          )}
        </div>
      </div>

      {/* Note */}
      <div style={{ padding: "0 16px 8px", fontSize: "7px", color: "#888" }}>
        <strong>Note:</strong> This transaction slip does not confer the right to the <strong>General Multipurpose Card</strong> (For any enquiry please contact)
      </div>

      {/* Footer */}
      <div style={{ background: "#f5f0e0", borderTop: "1px solid #e0d8c0", padding: "6px 16px", display: "flex", justifyContent: "space-between", fontSize: "7px", color: "#888" }}>
        <span>helpdesk@nimc.gov.ng</span>
        <span>www.nimc.gov.ng</span>
        <span>Powered by THE EAGLES VTU</span>
      </div>
    </div>
  );
};

const cellStyle: React.CSSProperties = {
  padding: "4px 6px",
  borderBottom: "1px solid #e0d8c0",
  verticalAlign: "top",
};
/* ─── Info Field Component ─── */
const InfoField = ({ label, value, fullWidth }: { label: string; value?: string | null; fullWidth?: boolean }) => {
  if (!value) return null;
  return (
    <div className={`${fullWidth ? "col-span-2" : ""}`}>
      <div className="border-l-2 border-primary/30 pl-3">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
};

export default NinPrint;
