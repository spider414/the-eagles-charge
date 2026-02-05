import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone, Wifi, Zap, Tv, Globe, Wallet, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import TransactionDetailDialog from "./TransactionDetailDialog";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  status: string;
  created_at: string;
  phone_number?: string;
  network?: string;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "airtime":
      return <Phone className="h-4 w-4" />;
    case "data":
      return <Wifi className="h-4 w-4" />;
    case "electricity":
      return <Zap className="h-4 w-4" />;
    case "cable_tv":
      return <Tv className="h-4 w-4" />;
    case "internet":
      return <Globe className="h-4 w-4" />;
    case "wallet_topup":
      return <Wallet className="h-4 w-4" />;
    default:
      return <Wallet className="h-4 w-4" />;
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

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return <Badge variant="default" className="bg-green-500/20 text-green-600 text-xs">Completed</Badge>;
    case "pending":
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 text-xs">Pending</Badge>;
    case "processing":
      return <Badge variant="secondary" className="bg-blue-500/20 text-blue-600 text-xs">Processing</Badge>;
    case "failed":
      return <Badge variant="destructive" className="bg-red-500/20 text-red-600 text-xs">Failed</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">{status}</Badge>;
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

const RecentTransactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const fetchRecentTransactions = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("transactions")
        .select("id, transaction_type, amount, status, created_at, phone_number, network")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      if (!error && data) {
        setTransactions(data);
      }
      setIsLoading(false);
    };

    fetchRecentTransactions();
  }, [user]);

  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-3 bg-muted rounded w-16" />
                </div>
                <div className="h-4 bg-muted rounded w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card className="mb-8">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Wallet className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No transactions yet</p>
            <p className="text-xs">Your recent activity will appear here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8 animate-fade-in">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Transactions
        </CardTitle>
        <Link 
          to="/history" 
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <div 
              key={tx.id} 
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors animate-fade-in cursor-pointer"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => {
                setSelectedTransaction(tx);
                setDialogOpen(true);
              }}
            >
              <div className={`w-10 h-10 rounded-xl ${getTransactionColor(tx.transaction_type)} flex items-center justify-center text-white`}>
                {getTransactionIcon(tx.transaction_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {formatTransactionType(tx.transaction_type)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">₦{tx.amount.toLocaleString()}</p>
                {getStatusBadge(tx.status)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <TransactionDetailDialog
        transaction={selectedTransaction}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  );
};

export default RecentTransactions;
