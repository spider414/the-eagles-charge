import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Wifi, Zap, Tv, Globe, Wallet, Download, Share2, Copy, Check } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  phone_number?: string;
  network?: string;
}

interface TransactionDetailDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "airtime":
      return <Phone className="h-5 w-5" />;
    case "data":
      return <Wifi className="h-5 w-5" />;
    case "electricity":
      return <Zap className="h-5 w-5" />;
    case "cable_tv":
      return <Tv className="h-5 w-5" />;
    case "internet":
      return <Globe className="h-5 w-5" />;
    case "wallet_topup":
      return <Wallet className="h-5 w-5" />;
    default:
      return <Wallet className="h-5 w-5" />;
  }
};

const getTransactionColor = (type: string) => {
  switch (type) {
    case "airtime":
      return "bg-primary";
    case "data":
      return "bg-emerald-500";
    case "electricity":
      return "bg-yellow-500";
    case "cable_tv":
      return "bg-blue-500";
    case "internet":
      return "bg-violet-500";
    case "wallet_topup":
      return "bg-green-500";
    default:
      return "bg-muted";
  }
};

const formatTransactionType = (type: string) => {
  switch (type) {
    case "airtime":
      return "Airtime";
    case "data":
      return "Data Bundle";
    case "electricity":
      return "Electricity";
    case "cable_tv":
      return "Cable TV";
    case "internet":
      return "Internet";
    case "wallet_topup":
      return "Wallet Top-up";
    default:
      return type;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge className="bg-green-500/20 text-green-600">Completed</Badge>;
    case "pending":
      return <Badge className="bg-yellow-500/20 text-yellow-600">Pending</Badge>;
    case "processing":
      return <Badge className="bg-blue-500/20 text-blue-600">Processing</Badge>;
    case "failed":
      return <Badge className="bg-red-500/20 text-red-600">Failed</Badge>;
    case "refunded":
      return <Badge className="bg-purple-500/20 text-purple-600">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const TransactionDetailDialog = React.forwardRef<HTMLDivElement, TransactionDetailDialogProps>(({ transaction, open, onOpenChange }, ref) => {
  const [copied, setCopied] = useState(false);

  if (!transaction) return null;

  const receiptText = `
Eagles VTU Receipt
-------------------
Transaction: ${formatTransactionType(transaction.transaction_type)}
Amount: ₦${transaction.amount.toLocaleString()}
Status: ${transaction.status}
Date: ${format(new Date(transaction.created_at), "PPpp")}
${transaction.phone_number ? `Phone: ${transaction.phone_number}` : ""}
${transaction.network ? `Network: ${transaction.network.toUpperCase()}` : ""}
Reference: ${transaction.id}
-------------------
Thank you for using Eagles VTU!
  `.trim();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(receiptText);
    setCopied(true);
    toast({ title: "Copied!", description: "Transaction details copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Transaction Receipt",
          text: receiptText,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          handleCopy();
        }
      }
    } else {
      handleCopy();
    }
  };

  const handleDownload = () => {
    const blob = new Blob([receiptText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `receipt-${transaction.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded!", description: "Receipt saved to your device" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-xl ${getTransactionColor(transaction.transaction_type)} flex items-center justify-center text-white`}>
              {getTransactionIcon(transaction.transaction_type)}
            </div>
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Type</span>
              <span className="font-medium">{formatTransactionType(transaction.transaction_type)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Amount</span>
              <span className="font-bold text-lg">₦{transaction.amount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Status</span>
              {getStatusBadge(transaction.status)}
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Date</span>
              <span className="text-sm">{format(new Date(transaction.created_at), "PPp")}</span>
            </div>
            {transaction.phone_number && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Phone</span>
                <span className="font-mono text-sm">{transaction.phone_number}</span>
              </div>
            )}
            {transaction.network && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground text-sm">Network</span>
                <span className="uppercase font-medium text-sm">{transaction.network}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-sm">Reference</span>
              <span className="font-mono text-xs">{transaction.id.slice(0, 8)}...</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copy
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});
TransactionDetailDialog.displayName = "TransactionDetailDialog";

export default TransactionDetailDialog;
