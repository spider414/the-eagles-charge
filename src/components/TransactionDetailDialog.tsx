import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Wifi, Zap, Tv, Globe, Wallet, Download, Share2, Copy, Check, Bird, Image } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { generateReceiptPDF, shareReceiptAsImage } from "@/utils/receiptGenerator";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  phone_number?: string;
  network?: string;
  data_plan?: string;
  description?: string;
  meter_number?: string;
  cable_smartcard?: string;
  cable_provider?: string;
  cable_plan?: string;
  electricity_provider?: string;
  token?: string;
  balance_before?: number | null;
  balance_after?: number | null;
  paystack_reference?: string;
}

interface TransactionDetailDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "airtime": return <Phone className="h-5 w-5" />;
    case "data": return <Wifi className="h-5 w-5" />;
    case "electricity": return <Zap className="h-5 w-5" />;
    case "cable_tv": return <Tv className="h-5 w-5" />;
    case "internet": return <Globe className="h-5 w-5" />;
    case "wallet_topup": return <Wallet className="h-5 w-5" />;
    default: return <Wallet className="h-5 w-5" />;
  }
};

const getTransactionColor = (type: string) => {
  switch (type) {
    case "airtime": return "bg-primary";
    case "data": return "bg-emerald-500";
    case "electricity": return "bg-yellow-500";
    case "cable_tv": return "bg-blue-500";
    case "internet": return "bg-violet-500";
    case "wallet_topup": return "bg-green-500";
    default: return "bg-muted";
  }
};

const formatTransactionType = (type: string) => {
  const map: Record<string, string> = {
    airtime: "Airtime", data: "Data Bundle", electricity: "Electricity",
    cable_tv: "Cable TV", internet: "Internet", wallet_topup: "Wallet Top-up",
    verification: "Verification",
  };
  return map[type] || type;
};

const getStatusBadge = (status: string) => {
  const styles: Record<string, string> = {
    completed: "bg-green-500/20 text-green-600",
    pending: "bg-yellow-500/20 text-yellow-600",
    processing: "bg-blue-500/20 text-blue-600",
    failed: "bg-red-500/20 text-red-600",
    refunded: "bg-purple-500/20 text-purple-600",
  };
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge className={`${styles[status] || ""} border-0`}>{label}</Badge>;
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
    <span className="text-muted-foreground text-xs shrink-0">{label}</span>
    <span className="font-medium text-xs text-right break-all">{value}</span>
  </div>
);

const TransactionDetailDialog = ({ transaction, open, onOpenChange }: TransactionDetailDialogProps) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  if (!transaction) return null;

  const receiptText = [
    "Eagle Recharge Receipt",
    "-------------------",
    `Transaction: ${formatTransactionType(transaction.transaction_type)}`,
    `Amount: ₦${transaction.amount.toLocaleString()}`,
    `Status: ${transaction.status}`,
    `Date: ${format(new Date(transaction.created_at), "PPpp")}`,
    transaction.phone_number && `Phone: ${transaction.phone_number}`,
    transaction.network && `Network: ${transaction.network.toUpperCase()}`,
    transaction.data_plan && `Plan: ${transaction.data_plan}`,
    transaction.description && `Description: ${transaction.description}`,
    transaction.meter_number && `Meter: ${transaction.meter_number}`,
    transaction.cable_smartcard && `Smartcard: ${transaction.cable_smartcard}`,
    transaction.token && `Token: ${transaction.token}`,
    `Reference: ${transaction.id}`,
    "-------------------",
    "Thank you for using Eagle Recharge!",
  ].filter(Boolean).join("\n");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(receiptText);
    setCopied(true);
    toast({ title: "Copied!", description: "Receipt copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPDF = async () => {
    try {
      await generateReceiptPDF(transaction);
      toast({ title: "Downloaded!", description: "PDF receipt saved to your device" });
    } catch {
      toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
    }
  };

  const handleShareImage = async () => {
    setSharing(true);
    try {
      await shareReceiptAsImage("receipt-card", transaction.id);
      toast({ title: "Shared!", description: "Receipt image shared successfully" });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast({ title: "Error", description: "Failed to share receipt image", variant: "destructive" });
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] sm:max-w-sm p-4 gap-3">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className={`w-8 h-8 rounded-lg ${getTransactionColor(transaction.transaction_type)} flex items-center justify-center text-white shrink-0`}>
              {getTransactionIcon(transaction.transaction_type)}
            </div>
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Receipt card with watermark - this is captured for image share */}
          <div id="receipt-card" className="relative bg-muted/50 rounded-lg p-3 overflow-hidden">
            {/* Watermark */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <div className="flex flex-col items-center gap-0.5 opacity-[0.05] rotate-[-20deg]">
                <Bird className="h-14 w-14" />
                <span className="text-lg font-black tracking-widest uppercase whitespace-nowrap">Eagle Recharge</span>
              </div>
            </div>

            <div className="relative z-10">
              <DetailRow label="Type" value={formatTransactionType(transaction.transaction_type)} />
              <DetailRow label="Amount" value={<span className="font-bold text-sm text-primary">₦{transaction.amount.toLocaleString()}</span>} />
              <DetailRow label="Status" value={getStatusBadge(transaction.status)} />
              <DetailRow label="Date" value={format(new Date(transaction.created_at), "PPp")} />
              {transaction.description && <DetailRow label="Description" value={transaction.description} />}
              {transaction.phone_number && <DetailRow label="Phone" value={<span className="font-mono">{transaction.phone_number}</span>} />}
              {transaction.network && <DetailRow label="Network" value={<span className="uppercase">{transaction.network}</span>} />}
              {transaction.data_plan && <DetailRow label="Plan" value={transaction.data_plan} />}
              {transaction.meter_number && <DetailRow label="Meter No." value={<span className="font-mono">{transaction.meter_number}</span>} />}
              {transaction.electricity_provider && <DetailRow label="Provider" value={<span className="uppercase">{transaction.electricity_provider}</span>} />}
              {transaction.cable_smartcard && <DetailRow label="Smartcard" value={<span className="font-mono">{transaction.cable_smartcard}</span>} />}
              {transaction.cable_provider && <DetailRow label="Cable Provider" value={<span className="uppercase">{transaction.cable_provider}</span>} />}
              {transaction.cable_plan && <DetailRow label="Cable Plan" value={transaction.cable_plan} />}
              {transaction.token && <DetailRow label="Token" value={<span className="font-mono text-primary font-bold">{transaction.token}</span>} />}
              {transaction.balance_before != null && <DetailRow label="Bal. Before" value={`₦${transaction.balance_before.toLocaleString()}`} />}
              {transaction.balance_after != null && <DetailRow label="Bal. After" value={`₦${transaction.balance_after.toLocaleString()}`} />}
              {transaction.paystack_reference && <DetailRow label="Payment Ref" value={<span className="font-mono text-[10px]">{transaction.paystack_reference}</span>} />}
              <DetailRow label="Reference" value={<span className="font-mono text-[10px]">{transaction.id.slice(0, 8)}...</span>} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 mr-1" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              Copy
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs" onClick={handleDownloadPDF}>
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button variant="outline" size="sm" className="h-9 text-xs col-span-2" onClick={handleShareImage} disabled={sharing}>
              <Image className="h-3.5 w-3.5 mr-1" />
              {sharing ? "Preparing..." : "Share as Image"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TransactionDetailDialog;
