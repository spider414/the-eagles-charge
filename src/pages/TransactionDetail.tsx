import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  ShieldCheck,
  CreditCard,
  Phone,
  Wifi,
  Zap,
  Tv,
  Globe,
  Receipt,
  Copy,
  Share2,
  Download,
  Printer,
  Check,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HelpCircle,
  ExternalLink,
  Hash,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  GraduationCap,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";
import { format } from "date-fns";
import {
  buildReceiptText,
  downloadReceiptPdf,
  shareReceiptPdf,
  type ReceiptDoc,
} from "@/utils/receiptGenerator";

interface TransactionData {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  phone_number: string | null;
  network: string | null;
  data_plan: string | null;
  cable_provider: string | null;
  cable_smartcard: string | null;
  cable_plan: string | null;
  electricity_provider: string | null;
  meter_number: string | null;
  meter_type: string | null;
  token: string | null;
  paystack_reference: string | null;
  api_response: any;
  balance_before: number | null;
  balance_after: number | null;
  description: string | null;
}

const serviceLabels: Record<string, string> = {
  "nin-verification": "NIN Search",
  "nin-phone": "NIN Phone Search",
  "nin-tracking": "NIN Tracking",
  "nin-demography": "NIN Demography",
  "bvn-verification": "BVN Verification",
  "bvn-phone": "BVN Phone Search",
  "nin-print-premium": "NIN Print (Premium)",
  "nin-print-standard": "NIN Print (Standard)",
  "nin-print-regular": "NIN Print (Regular)",
  "bvn-print-card": "BVN Print (Card)",
  "bvn-print-slip": "BVN Print (Slip)",
};

const getServiceCategory = (tx: TransactionData): string => {
  if (tx.transaction_type === "verification" && tx.data_plan) {
    if (tx.data_plan.startsWith("nin")) return "NIN";
    if (tx.data_plan.startsWith("bvn")) return "BVN";
  }
  switch (tx.transaction_type) {
    case "airtime": return "Airtime";
    case "data": return "Data";
    case "electricity": return "Electricity";
    case "cable_tv": return "Cable TV";
    case "internet": return "Internet";
    case "wallet_topup": return "Wallet";
    case "exam_pin": return "Exam PIN";
    default: return "Other";
  }
};

const getServiceName = (tx: TransactionData): string => {
  if (tx.transaction_type === "verification" && tx.data_plan) {
    return serviceLabels[tx.data_plan] || tx.data_plan;
  }
  switch (tx.transaction_type) {
    case "airtime": return "Airtime Purchase";
    case "data": return `Data Bundle${tx.data_plan ? ` (${tx.data_plan})` : ""}`;
    case "electricity": return `Electricity${tx.electricity_provider ? ` - ${tx.electricity_provider.toUpperCase()}` : ""}`;
    case "cable_tv": return `Cable TV${tx.cable_provider ? ` - ${tx.cable_provider.toUpperCase()}` : ""}`;
    case "internet": return "Internet Subscription";
    case "wallet_topup": return "Wallet Top-up";
    case "exam_pin": return "Exam PIN Purchase";
    default: return tx.transaction_type;
  }
};

// Normalise a single pin string. CheapDataHub returns "serial<=>pin".
const normalisePinString = (raw: string): string => {
  const value = String(raw).trim();
  // Split on common delimiters used by CheapDataHub / other providers
  const parts = value.split(/<=>|\|\||::|\s*\|\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) return `Serial: ${parts[0]}  •  PIN: ${parts[1]}`;
  return value;
};

// Extract exam pins from transaction api_response
const extractExamPins = (apiResponse: any): string[] => {
  if (!apiResponse) return [];
  const pins: string[] = [];
  const data = apiResponse.data || apiResponse;
  // CheapDataHub returns pins under data.delivery.pins
  const candidates = [
    data?.delivery?.pins,
    data?.pins,
    data?.pin_list,
    data?.codes,
    apiResponse?.delivery?.pins,
    apiResponse?.pins,
    apiResponse?.pin_list,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) {
      c.forEach((item: any) => {
        if (typeof item === "string") pins.push(normalisePinString(item));
        else if (item?.serial && item?.pin) pins.push(`Serial: ${item.serial}  •  PIN: ${item.pin}`);
        else if (item?.pin) pins.push(normalisePinString(String(item.pin)));
        else if (item?.code) pins.push(normalisePinString(String(item.code)));
      });
      if (pins.length) return pins;
    }
  }
  if (data?.pin) pins.push(normalisePinString(String(data.pin)));
  if (!pins.length && apiResponse?.pin) pins.push(normalisePinString(String(apiResponse.pin)));
  return pins;
};

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "airtime": return Phone;
    case "data": return Wifi;
    case "electricity": return Zap;
    case "cable_tv": return Tv;
    case "internet": return Globe;
    case "wallet_topup": return Wallet;
    case "verification": return ShieldCheck;
    case "exam_pin": return GraduationCap;
    default: return Receipt;
  }
};

const getIconColor = (type: string) => {
  switch (type) {
    case "airtime": return "bg-primary text-primary-foreground";
    case "data": return "bg-emerald-500 text-white";
    case "electricity": return "bg-yellow-500 text-white";
    case "cable_tv": return "bg-blue-500 text-white";
    case "internet": return "bg-violet-500 text-white";
    case "wallet_topup": return "bg-green-500 text-white";
    case "verification": return "bg-primary text-primary-foreground";
    case "exam_pin": return "bg-orange-500 text-white";
    default: return "bg-muted text-muted-foreground";
  }
};

const isMoneyIn = (tx: TransactionData) => tx.transaction_type === "wallet_topup";

const TransactionDetail = () => {
  const navigate = useNavigate();
  const { formatCurrency, formatDateTime } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const { user, profile, isLoading } = useAuth();
  const { toast } = useToast();
  const [transaction, setTransaction] = useState<TransactionData | null>(null);
  const [feeEntry, setFeeEntry] = useState<{
    gross_amount: number;
    fee_percent: number;
    fee_amount: number;
    net_amount: number;
    method: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const feeConfig = useDepositFee();

  // Prefer the recorded ledger entry; fall back to live settings for older deposits.
  const feeBreakdown = (() => {
    if (!transaction || transaction.transaction_type !== "wallet_topup") return null;
    if (feeEntry) {
      return {
        gross: Number(feeEntry.gross_amount),
        fee: Number(feeEntry.fee_amount),
        percent: Number(feeEntry.fee_percent),
        net: Number(feeEntry.net_amount),
        logged: true,
      };
    }
    if (feeConfig.loading || !feeConfig.enabled) return null;
    const gross = Number(transaction.amount);
    return {
      gross,
      fee: depositFee(gross, feeConfig),
      percent: feeConfig.percent,
      net: netDeposit(gross, feeConfig),
      logged: false,
    };
  })();

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user && id) fetchTransaction();
  }, [user, id]);

  const fetchTransaction = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("id", id!)
        .eq("user_id", user!.id)
        .single();

      if (error) throw error;
      setTransaction(data as unknown as TransactionData);

      if (data?.transaction_type === "wallet_topup") {
        const { data: fee } = await supabase
          .from("deposit_fee_log")
          .select("gross_amount, fee_percent, fee_amount, net_amount, method")
          .eq("transaction_id", data.id)
          .maybeSingle();
        setFeeEntry(fee ?? null);
      } else {
        setFeeEntry(null);
      }
    } catch {
      toast({ title: "Error", description: "Transaction not found", variant: "destructive" });
      navigate("/history");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case "processing":
        return <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      case "failed":
        return <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case "refunded":
        return <Badge className="bg-purple-500/20 text-purple-600 border-purple-500/30"><RefreshCw className="h-3 w-3 mr-1" />Refunded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const generateReference = (tx: TransactionData) => {
    const typePrefix = tx.transaction_type === "verification" && tx.data_plan
      ? tx.data_plan.toUpperCase().replace(/-/g, "_")
      : tx.transaction_type.toUpperCase();
    const dateStr = format(new Date(tx.created_at), "yyMMddHHmmss");
    const idSuffix = tx.id.slice(0, 6).toUpperCase();
    return `${typePrefix}_${dateStr}_${idSuffix}`;
  };

  const buildDoc = (tx: TransactionData): ReceiptDoc => {
    const naira = (n: number) => `NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const rows: Array<[string, string]> = [
      ["Transaction ID", `#${tx.id.slice(0, 6)}`],
      ["Reference", generateReference(tx)],
      ["Service Type", getServiceCategory(tx)],
      ["Service Name", getServiceName(tx)],
      ["Direction", isMoneyIn(tx) ? "Money In" : "Money Out"],
      ["Method", tx.paystack_reference ? "Paystack" : "Wallet"],
      ["Date", format(new Date(tx.created_at), "MMM dd, yyyy 'at' HH:mm:ss")],
      ["Description", tx.description || ""],
      ["Phone Number", tx.phone_number || ""],
      ["Network", tx.network?.toUpperCase() || ""],
      ["Data Plan", tx.data_plan || ""],
      ["Meter Number", tx.meter_number || ""],
      ["Meter Type", tx.meter_type || ""],
      ["Token", tx.token || ""],
      ["Smartcard", tx.cable_smartcard || ""],
      ["Cable Provider", tx.cable_provider?.toUpperCase() || ""],
      ["Cable Plan", tx.cable_plan || ""],
      ["Payment Ref", tx.paystack_reference || ""],
      ["Balance Before", tx.balance_before != null ? naira(tx.balance_before) : ""],
      ["Balance After", tx.balance_after != null ? naira(tx.balance_after) : ""],
    ];
    if (isMoneyIn(tx) && feeBreakdown) {
      rows.push(
        ["Amount Received", naira(feeBreakdown.gross)],
        ["Funding Fee", `${naira(feeBreakdown.fee)} (${feeBreakdown.percent}%)`],
        ["Credited to Wallet", naira(feeBreakdown.net)],
      );
    }
    return {
      title: `${getServiceName(tx)} Receipt`,
      reference: generateReference(tx),
      transactionId: tx.id,
      amount: tx.amount,
      moneyIn: isMoneyIn(tx),
      status: tx.status,
      date: tx.created_at,
      rows: rows.filter(([, v]) => v),
      pins: tx.transaction_type === "exam_pin" ? extractExamPins(tx.api_response) : undefined,
    };
  };

  const receiptText = transaction ? buildReceiptText(buildDoc(transaction)) : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(receiptText);
    setCopied(true);
    toast({ title: "Copied!", description: "Transaction details copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!transaction) return;
    try {
      const result = await shareReceiptPdf(buildDoc(transaction), receiptText);
      if (result === "downloaded") {
        toast({ title: "Receipt saved", description: "Sharing isn't supported here, so we saved the PDF instead." });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") handleCopy();
    }
  };

  const handleDownload = async () => {
    if (!transaction) return;
    try {
      await downloadReceiptPdf(buildDoc(transaction));
      toast({ title: "Downloaded!", description: "PDF receipt saved to your device" });
    } catch {
      toast({ title: "Error", description: "Could not generate the receipt PDF", variant: "destructive" });
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  if (!user || !transaction) return null;

  const Icon = getTransactionIcon(transaction.transaction_type);
  const moneyIn = isMoneyIn(transaction);
  const isVerification = transaction.transaction_type === "verification";
  const hasSlipData = isVerification && transaction.status === "completed" && transaction.api_response;
  const isExamPin = transaction.transaction_type === "exam_pin";
  const examPins = isExamPin ? extractExamPins(transaction.api_response) : [];

  const handleCopyPin = async (pin: string) => {
    await navigator.clipboard.writeText(pin);
    toast({ title: "PIN Copied!", description: "Exam PIN copied to clipboard" });
  };

  const handleCopyAllPins = async () => {
    await navigator.clipboard.writeText(examPins.join("\n"));
    toast({ title: "All PINs Copied!", description: `${examPins.length} pin(s) copied to clipboard` });
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${getIconColor(transaction.transaction_type)}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold text-foreground">Transaction Details</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">{formatCurrency(profile?.wallet_balance ?? 0)}</span>
            </div>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-5 max-w-lg mx-auto">
          {/* Transaction ID Header */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-2xl ${getIconColor(transaction.transaction_type)} flex items-center justify-center`}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-foreground">Transaction Details</h2>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    Transaction ID: #{transaction.id.slice(0, 6)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-xl font-bold ${moneyIn ? "text-green-600" : "text-foreground"}`}>
                    {moneyIn ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ExternalLink className="h-4 w-4 text-primary" />
                Quick Actions
              </CardTitle>
              <p className="text-xs text-muted-foreground">Access related services and information for this transaction.</p>
            </CardHeader>
            <CardContent className="pb-4">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  <span className="text-[10px]">Copy</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1" onClick={handleShare}>
                  <Share2 className="h-4 w-4" />
                  <span className="text-[10px]">Share</span>
                </Button>
                <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1" onClick={handleDownload}>
                  <Download className="h-4 w-4" />
                  <span className="text-[10px]">Download</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Transaction Information */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Transaction Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              <InfoRow label="Transaction ID" value={`#${transaction.id.slice(0, 6)}`} mono />
              <InfoRow label="Reference" value={generateReference(transaction)} mono />
              <InfoRow label="Service Type" value={getServiceCategory(transaction)} />
              <InfoRow label="Service Name" value={getServiceName(transaction)} />
              <InfoRow
                label="Transaction Type"
                value={
                  <span className={`flex items-center gap-1 text-sm font-medium ${moneyIn ? "text-green-600" : "text-red-500"}`}>
                    {moneyIn ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {moneyIn ? "Money In" : "Money Out"}
                  </span>
                }
              />
              <InfoRow
                label="Amount"
                value={
                  <span className={`font-bold ${moneyIn ? "text-green-600" : "text-foreground"}`}>
                    {moneyIn ? "+" : "-"}{formatCurrency(transaction.amount)}
                  </span>
                }
              />
              {transaction.balance_before != null && (
                <InfoRow label="Balance Before" value={`${formatCurrency(transaction.balance_before)}`} />
              )}
              {transaction.balance_after != null && (
                <InfoRow label="Balance After" value={`${formatCurrency(transaction.balance_after)}`} />
              )}
              <InfoRow label="Status" value={getStatusBadge(transaction.status)} />
              <InfoRow label="Method" value={transaction.paystack_reference ? "Paystack" : "Wallet"} />
              <InfoRow
                label="Date"
                value={formatDateTime(transaction.created_at)}
              />
              {transaction.description && (
                <InfoRow label="Description" value={transaction.description} />
              )}
              {transaction.phone_number && (
                <InfoRow label="Phone Number" value={transaction.phone_number} mono />
              )}
              {transaction.network && (
                <InfoRow label="Network" value={transaction.network.toUpperCase()} />
              )}
              {transaction.meter_number && (
                <InfoRow label="Meter Number" value={transaction.meter_number} mono />
              )}
              {transaction.meter_type && (
                <InfoRow label="Meter Type" value={transaction.meter_type} />
              )}
              {transaction.token && (
                <InfoRow label="Token" value={transaction.token} mono />
              )}
              {transaction.cable_smartcard && (
                <InfoRow label="Smartcard" value={transaction.cable_smartcard} mono />
              )}
              {transaction.cable_plan && (
                <InfoRow label="Cable Plan" value={transaction.cable_plan} />
              )}
            </CardContent>
          </Card>

          {/* Related Verification Service (only for verification transactions) */}
          {isVerification && (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Related Verification Service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Service" value={getServiceName(transaction)} />
                <InfoRow label="Category" value={getServiceCategory(transaction)} />
                <InfoRow label="Status" value={getStatusBadge(transaction.status)} />
                {transaction.data_plan && (
                  <InfoRow
                    label="Slip Type"
                    value={
                      transaction.data_plan.includes("print")
                        ? transaction.data_plan.includes("premium") ? "Premium"
                          : transaction.data_plan.includes("standard") ? "Standard"
                          : "Regular"
                        : "N/A"
                    }
                  />
                )}
                <InfoRow
                  label="PDF Status"
                  value={
                    hasSlipData ? (
                      <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Available</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Not Generated</Badge>
                    )
                  }
                />
                {hasSlipData && (
                  <div className="pt-3">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => navigate("/verification-history", { state: { selectedTxId: transaction.id } })}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Re-Print / Download Slip
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Exam PINs (only for exam_pin transactions) */}
          {isExamPin && (
            <Card className="border-orange-500/30">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-orange-500" />
                    Purchased Exam PINs
                  </CardTitle>
                  {examPins.length > 1 && (
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleCopyAllPins}>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy All
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {examPins.length > 0
                    ? "Tap any PIN to copy it to your clipboard."
                    : transaction.status === "completed"
                      ? "PIN data not available. Contact support if you didn't receive your PINs."
                      : "PINs will appear here once your purchase is completed."}
                </p>
              </CardHeader>
              {examPins.length > 0 && (
                <CardContent className="space-y-2">
                  {examPins.map((pin, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleCopyPin(pin)}
                      className="w-full flex items-center justify-between gap-2 bg-muted/50 hover:bg-muted rounded-lg p-3 border border-border/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <KeyRound className="h-4 w-4 text-orange-500 shrink-0" />
                        <code className="text-sm font-mono break-all text-foreground">{pin}</code>
                      </div>
                      <Copy className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Current Wallet Balance */}
          <Card className="bg-muted/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Current Wallet Balance</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(profile?.wallet_balance ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Available for services</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Need Help */}
          <Card>
            <CardContent className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Need Help?</p>
                <p className="text-xs text-muted-foreground">Have questions about this transaction?</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate("/support")}>
                Contact Us
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </PageTransition>
  );
};

// Reusable info row component
const InfoRow = ({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border/50 last:border-0">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium text-right max-w-[60%] truncate ${mono ? "font-mono" : ""}`}>
      {value}
    </span>
  </div>
);

export default TransactionDetail;
