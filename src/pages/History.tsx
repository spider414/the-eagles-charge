import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Phone, Wifi, Zap, Tv, Globe, Receipt, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import TransactionDetailDialog from "@/components/TransactionDetailDialog";
import BrandLogo from "@/components/BrandLogo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/contexts/LanguageContext";

interface Transaction {
  id: string;
  transaction_type: "airtime" | "data" | "electricity" | "cable_tv" | "internet";
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  amount: number;
  phone_number: string | null;
  network: string | null;
  data_plan: string | null;
  cable_provider: string | null;
  electricity_provider: string | null;
  paystack_reference: string | null;
  created_at: string;
}

const getTransactionIcon = (type: string) => {
  switch (type) {
    case "airtime":
      return Phone;
    case "data":
      return Wifi;
    case "electricity":
      return Zap;
    case "cable_tv":
      return Tv;
    case "internet":
      return Globe;
    default:
      return Receipt;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed":
      return "bg-green-100 text-green-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "processing":
      return "bg-blue-100 text-blue-800";
    case "failed":
      return "bg-red-100 text-red-800";
    case "refunded":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const History = () => {
  const navigate = useNavigate();
  const { t, formatCurrency, formatDateTime } = useLanguage();
  const { user, isLoading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (!user) return;

      setIsLoading(true);
      let query = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (filter !== "all") {
        query = query.eq("transaction_type", filter as "airtime" | "data" | "electricity" | "cable_tv" | "internet");
      }

      const { data, error } = await query;

      if (!error && data) {
        setTransactions(data as Transaction[]);
      }
      setIsLoading(false);
    };

    fetchTransactions();
  }, [user, filter]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BrandLogo className="h-10 w-10" rounded="rounded-xl" />
              <span className="text-xl font-bold text-foreground">
                <span className="text-gradient-gold">{t("history.title")}</span>
              </span>
            </div>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="container py-8">
        {/* Filter */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t("history.filter")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("history.all")}</SelectItem>
                <SelectItem value="airtime">{t("service.airtime")}</SelectItem>
                <SelectItem value="data">{t("service.data")}</SelectItem>
                <SelectItem value="electricity">{t("service.electricity")}</SelectItem>
                <SelectItem value="cable_tv">{t("service.cable")}</SelectItem>
                <SelectItem value="internet">{t("service.internet")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transactions List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-pulse-soft text-primary">{t("history.loading")}</div>
          </div>
        ) : transactions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t("history.empty")}</h3>
              <p className="text-muted-foreground mb-4">
                {t("history.emptyDesc")}
              </p>
              <Link to="/dashboard">
                <Button>{t("history.firstPurchase")}</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {transactions.map((tx) => {
                const Icon = getTransactionIcon(tx.transaction_type);
                return (
                  <Card 
                    key={tx.id} 
                    className="hover:shadow-card transition-shadow cursor-pointer"
                    onClick={() => navigate(`/transaction/${tx.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4">
                          <div className="p-3 rounded-xl bg-muted">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium capitalize">
                                {tx.transaction_type.replace("_", " ")}
                              </span>
                              <Badge variant="secondary" className={getStatusColor(tx.status)}>
                                {t(`status.${tx.status}` as const)}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {tx.phone_number && `${tx.phone_number} • `}
                              {tx.network && `${tx.network.toUpperCase()} • `}
                              {tx.data_plan && `${tx.data_plan} • `}
                              {tx.cable_provider && `${tx.cable_provider.toUpperCase()} • `}
                              {tx.electricity_provider && `${tx.electricity_provider.toUpperCase()}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDateTime(tx.created_at)}
                            </p>
                            {tx.paystack_reference && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {t("history.ref")}: {tx.paystack_reference}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">
                            {formatCurrency(tx.amount)}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <TransactionDetailDialog
              transaction={selectedTransaction}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default History;
