import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  Printer,
  Wallet,
  Clock,
  CheckCircle2,
  ShieldCheck,
  FileText,
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

type SlipType = "bvn-card" | "bvn-slip";

interface BvnData {
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  bvn?: string;
  gender?: string;
  date_of_birth?: string;
  phone?: string;
  email?: string;
  state_of_origin?: string;
  state_of_residence?: string;
  nationality?: string;
  photo?: string | null;
}

const sampleData: BvnData = {
  full_name: "JOHN DOE SMITH",
  bvn: "12345678901",
  gender: "Male",
  date_of_birth: "01-01-1990",
  phone: "08012345678",
  email: "john@example.com",
  state_of_origin: "Lagos",
  state_of_residence: "Abuja",
  nationality: "Nigerian",
};

const getSlipHtml = (content: string, title: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <title>${title}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
      .print-container { background: white; }
      @media print { body { background: white; } .print-container { box-shadow: none !important; } }
    </style>
  </head>
  <body>${content}</body>
  </html>
`;

const BvnPrint = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [slipType, setSlipType] = useState<SlipType | "">("");
  const [bvnNumber, setBvnNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<BvnData | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  const price = slipType === "bvn-card" ? 650 : slipType === "bvn-slip" ? 550 : 0;

  const handleVerify = async () => {
    if (!slipType) {
      toast({ title: "Select Slip Type", description: "Please select a slip type first", variant: "destructive" });
      return;
    }
    if (!bvnNumber || bvnNumber.replace(/\D/g, "").length !== 11) {
      toast({ title: "Invalid BVN", description: "BVN must be exactly 11 digits", variant: "destructive" });
      return;
    }
    if (!consent) {
      toast({ title: "Consent Required", description: "Please confirm you have obtained proper consent", variant: "destructive" });
      return;
    }

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
            phone_number: bvnNumber,
          },
        },
      });
      if (paymentError) throw new Error(paymentError.message);
      if (!paymentData?.success) {
        toast({ title: "Insufficient Balance", description: paymentData?.error || "Failed to debit wallet.", variant: "destructive" });
        setIsVerifying(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("verify-bvn", {
        body: { bvn: bvnNumber },
      });
      if (error) throw error;

      if (data?.success) {
        setResult(data.data);
        await supabase.from("transactions").insert({
          user_id: user!.id,
          transaction_type: "verification" as any,
          amount: price,
          status: "completed",
          data_plan: `bvn-print-${slipType === "bvn-card" ? "card" : "slip"}`,
          api_response: data.data,
          phone_number: bvnNumber,
          balance_before: paymentData.balance_before,
          balance_after: paymentData.balance_after,
          description: `Payment for BVN Print (${slipType === "bvn-card" ? "Card" : "Slip"})`,
        });
        await refreshProfile();
        toast({ title: "Verified!", description: "BVN verification successful. You can now print." });
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
          data_plan: `bvn-print-${slipType === "bvn-card" ? "card" : "slip"}`,
          api_response: { error: data?.error },
          phone_number: bvnNumber,
        });
        await refreshProfile();
        toast({ title: "Failed", description: data?.error || "BVN verification failed. Wallet refunded.", variant: "destructive" });
      }
    } catch (err: any) {
      try {
        await supabase.functions.invoke("paystack-payment", {
          body: { action: "credit_wallet", amount: price },
        });
        await refreshProfile();
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
    printWindow.document.write(getSlipHtml(printRef.current.innerHTML, `BVN ${slipType === "bvn-card" ? "Card" : "Slip"}`));
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const handleDownloadPdf = () => {
    if (!printRef.current) return;
    const pdfWindow = window.open("", "_blank");
    if (!pdfWindow) return;
    pdfWindow.document.write(getSlipHtml(printRef.current.innerHTML, `BVN ${slipType === "bvn-card" ? "Card" : "Slip"}`));
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
                <span className="text-lg font-bold text-foreground">Print BVN</span>
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
            <h1 className="text-2xl font-bold text-foreground">BVN Verification</h1>
            <p className="text-sm text-muted-foreground">Choose your preferred slip format and verify BVN details</p>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Select a slip type
              </CardTitle>
              <p className="text-xs text-muted-foreground">Choose between traditional slip format or modern ID card design</p>
            </CardHeader>
            <CardContent>
              <Select value={slipType} onValueChange={(v) => setSlipType(v as SlipType)}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Select a slip type --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bvn-card">
                    <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> BVN Card - ₦650.00</span>
                  </SelectItem>
                  <SelectItem value="bvn-slip">
                    <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> BVN Slip - ₦550.00</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {!result && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center font-medium">
                {slipType ? `Preview: ${slipType === "bvn-card" ? "BVN Card" : "BVN Slip"} format` : "Select a slip type to see preview"}
              </p>
              {slipType ? (
                <div className="relative">
                  <div className="opacity-70 pointer-events-none">
                    {slipType === "bvn-card" ? (
                      <BvnCardPreview data={sampleData} photoSrc={null} />
                    ) : (
                      <BvnSlipPreview data={sampleData} photoSrc={null} />
                    )}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 backdrop-blur-[2px] rounded-xl">
                    <div className="bg-background border border-border rounded-lg px-4 py-2 shadow-lg text-center">
                      <p className="text-xs font-semibold text-foreground">Sample Preview</p>
                      <p className="text-[10px] text-muted-foreground">Verify BVN to see actual data</p>
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
              <CardTitle className="text-base">Enter BVN Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bvn">Bank Verification Number (BVN)</Label>
                <Input id="bvn" type="text" placeholder="Enter 11-digit BVN" value={bvnNumber} onChange={(e) => setBvnNumber(e.target.value.replace(/\D/g, ""))} maxLength={11} />
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                <p><strong>Privacy Notice:</strong> Your BVN information is encrypted and securely processed. We never store your personal data after verification.</p>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox id="consent" checked={consent} onCheckedChange={(checked) => setConsent(checked === true)} className="mt-0.5" />
                <Label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  I confirm that I have obtained proper consent from the BVN owner for this verification.
                </Label>
              </div>

              <Button className="w-full" onClick={handleVerify} disabled={isVerifying || !slipType}>
                {isVerifying ? (
                  <><Clock className="h-4 w-4 mr-2 animate-spin" />Verifying...</>
                ) : (
                  <><ShieldCheck className="h-4 w-4 mr-2" />Verify & Generate {slipType === "bvn-card" ? "Card" : "Slip"} - ₦{price}</>
                )}
              </Button>
            </CardContent>
          </Card>

          {result && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                BVN Verified Successfully
              </div>

              <div ref={printRef}>
                {slipType === "bvn-card" ? (
                  <BvnCardPreview data={result} photoSrc={photoSrc} />
                ) : (
                  <BvnSlipPreview data={result} photoSrc={photoSrc} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button className="w-full" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" />Print
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

/* ─── BVN Card Preview (₦650) ─── */
const BvnCardPreview = ({ data, photoSrc }: { data: BvnData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "400px", margin: "0 auto",
    background: "linear-gradient(135deg, #1a5c2e 0%, #0d3b1c 50%, #1a5c2e 100%)",
    borderRadius: "16px", padding: "24px", color: "white", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  }}>
    <div style={{ textAlign: "center", marginBottom: "16px", borderBottom: "1px solid rgba(255,255,255,0.2)", paddingBottom: "12px" }}>
      <div style={{ fontSize: "10px", letterSpacing: "2px", opacity: 0.8 }}>FEDERAL REPUBLIC OF NIGERIA</div>
      <div style={{ fontSize: "16px", fontWeight: "bold", marginTop: "4px" }}>BANK VERIFICATION NUMBER</div>
      <div style={{ fontSize: "9px", opacity: 0.7, marginTop: "2px" }}>Central Bank of Nigeria</div>
    </div>
    <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
      {photoSrc ? (
        <img src={photoSrc} alt="BVN Photo" style={{ width: "90px", height: "110px", objectFit: "cover", borderRadius: "8px", border: "2px solid rgba(255,255,255,0.3)" }} />
      ) : (
        <div style={{ width: "90px", height: "110px", background: "rgba(255,255,255,0.1)", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", opacity: 0.5 }}>No Photo</div>
      )}
      <div style={{ flex: 1, fontSize: "11px", lineHeight: "1.6" }}>
        <div><span style={{ opacity: 0.7 }}>Name:</span> <strong>{data.full_name || "N/A"}</strong></div>
        <div><span style={{ opacity: 0.7 }}>BVN:</span> <strong style={{ letterSpacing: "1px" }}>{data.bvn || "N/A"}</strong></div>
        <div><span style={{ opacity: 0.7 }}>Gender:</span> <strong style={{ textTransform: "capitalize" }}>{data.gender || "N/A"}</strong></div>
        <div><span style={{ opacity: 0.7 }}>DOB:</span> <strong>{data.date_of_birth || "N/A"}</strong></div>
        <div><span style={{ opacity: 0.7 }}>Phone:</span> <strong>{data.phone || "N/A"}</strong></div>
      </div>
    </div>
    <div style={{ marginTop: "16px", borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "10px", fontSize: "10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div><span style={{ opacity: 0.7 }}>State:</span> {data.state_of_origin || "N/A"}</div>
        <div><span style={{ opacity: 0.7 }}>Nationality:</span> {data.nationality || "N/A"}</div>
      </div>
    </div>
  </div>
);

/* ─── BVN Slip Preview (₦550) ─── */
const BvnSlipPreview = ({ data, photoSrc }: { data: BvnData; photoSrc: string | null }) => (
  <div className="print-container" style={{
    width: "100%", maxWidth: "500px", margin: "0 auto",
    background: "white", border: "2px solid #1a5c2e",
    borderRadius: "8px", padding: "24px", fontFamily: "'Segoe UI', sans-serif",
    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
  }}>
    <div style={{ textAlign: "center", borderBottom: "2px solid #1a5c2e", paddingBottom: "12px", marginBottom: "16px" }}>
      <div style={{ fontSize: "11px", letterSpacing: "2px", color: "#666" }}>FEDERAL REPUBLIC OF NIGERIA</div>
      <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1a5c2e", marginTop: "4px" }}>BVN VERIFICATION SLIP</div>
      <div style={{ fontSize: "10px", color: "#999", marginTop: "2px" }}>Central Bank of Nigeria - Bank Verification Number</div>
    </div>
    <div style={{ display: "flex", gap: "20px" }}>
      <div style={{ flexShrink: 0 }}>
        {photoSrc ? (
          <img src={photoSrc} alt="BVN Photo" style={{ width: "100px", height: "120px", objectFit: "cover", border: "2px solid #1a5c2e", borderRadius: "4px" }} />
        ) : (
          <div style={{ width: "100px", height: "120px", background: "#f0f0f0", border: "2px solid #ccc", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#999" }}>No Photo</div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
          <tbody>
            {([
              ["Full Name", data.full_name], ["BVN", data.bvn], ["Gender", data.gender],
              ["Date of Birth", data.date_of_birth], ["Phone Number", data.phone], ["Email", data.email],
              ["State of Origin", data.state_of_origin], ["State of Residence", data.state_of_residence], ["Nationality", data.nationality],
            ] as [string, string | undefined][]).filter(([, val]) => val).map(([label, value]) => (
              <tr key={label}>
                <td style={{ padding: "4px 8px 4px 0", color: "#666", whiteSpace: "nowrap", verticalAlign: "top" }}>{label}:</td>
                <td style={{ padding: "4px 0", fontWeight: "600", textTransform: label === "Gender" ? "capitalize" : "none" }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    <div style={{ marginTop: "16px", borderTop: "1px solid #ddd", paddingTop: "10px", textAlign: "center", fontSize: "9px", color: "#999" }}>
      <p>This slip is generated for verification purposes only.</p>
      <p style={{ marginTop: "2px" }}>Powered by THE EAGLES VTU</p>
    </div>
  </div>
);

export default BvnPrint;
