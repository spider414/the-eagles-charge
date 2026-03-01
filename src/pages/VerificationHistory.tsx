import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  ShieldCheck,
  CreditCard,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface VerificationTransaction {
  id: string;
  amount: number;
  status: string;
  data_plan: string | null;
  phone_number: string | null;
  api_response: any;
  created_at: string;
}

const serviceLabels: Record<string, string> = {
  "nin-verification": "NIN Verification",
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

const getServiceCategory = (dataPlan: string | null): string => {
  if (!dataPlan) return "other";
  if (dataPlan.startsWith("nin")) return "nin";
  if (dataPlan.startsWith("bvn")) return "bvn";
  return "other";
};

const VerificationHistory = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [transactions, setTransactions] = useState<VerificationTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<VerificationTransaction | null>(null);
  const perPage = 15;

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) fetchTransactions();
  }, [user]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("id, amount, status, data_plan, phone_number, api_response, created_at")
        .eq("user_id", user!.id)
        .eq("transaction_type", "verification" as any)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTransactions((data as VerificationTransaction[]) || []);
    } catch (err: any) {
      toast({ title: "Error", description: "Failed to load transactions", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Apply filters
  const filtered = transactions.filter((tx) => {
    if (serviceFilter !== "all" && getServiceCategory(tx.data_plan) !== serviceFilter) return false;
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (fromDate && new Date(tx.created_at) < new Date(fromDate)) return false;
    if (toDate && new Date(tx.created_at) > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // Stats
  const totalTx = transactions.length;
  const completedTx = transactions.filter((t) => t.status === "completed");
  const failedTx = transactions.filter((t) => t.status === "failed");
  const totalSpent = completedTx.reduce((sum, t) => sum + t.amount, 0);
  const thisMonth = completedTx.filter((t) => {
    const d = new Date(t.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthSpent = thisMonth.reduce((sum, t) => sum + t.amount, 0);

  const handleReprint = (tx: VerificationTransaction) => {
    if (!tx.api_response || tx.status !== "completed") {
      toast({ title: "Unavailable", description: "No slip data available for this transaction", variant: "destructive" });
      return;
    }
    setSelectedTx(tx);
  };

  const handlePrintSelected = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Verification Slip</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Segoe UI', sans-serif; padding: 40px; }</style></head><body>${printRef.current.innerHTML}</body></html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading || loading) {
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
                  <BarChart3 className="h-5 w-5 text-secondary-foreground" />
                </div>
                <span className="text-lg font-bold text-foreground">My Transactions</span>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
            </div>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-6">
          {/* Title */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">My Transaction History</h1>
            <p className="text-sm text-muted-foreground">Track all your verification transactions. View and re-download your slips.</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <BarChart3 className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-2xl font-bold">{totalTx}</p>
                <p className="text-[10px] text-muted-foreground">Total Transactions</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
                <p className="text-2xl font-bold">{completedTx.length}</p>
                <p className="text-[10px] text-muted-foreground">Completed</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingDown className="h-5 w-5 mx-auto mb-1 text-destructive" />
                <p className="text-2xl font-bold">₦{totalSpent.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total Spent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <p className="text-2xl font-bold">₦{thisMonthSpent.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">This Month</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Filter Transactions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Service Type</Label>
                  <Select value={serviceFilter} onValueChange={(v) => { setServiceFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="nin">NIN Services</SelectItem>
                      <SelectItem value="bvn">BVN Services</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">From Date</Label>
                  <Input type="date" className="h-9 text-xs" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transaction List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Recent Transactions ({filtered.length} total)
              </h2>
              {totalPages > 1 && (
                <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
              )}
            </div>

            {paginated.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No verification transactions found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {paginated.map((tx) => (
                  <Card key={tx.id} className="hover:shadow-card transition-all cursor-pointer" onClick={() => navigate(`/transaction/${tx.id}`)}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          getServiceCategory(tx.data_plan) === "nin" ? "bg-primary/10" : "bg-blue-500/10"
                        }`}>
                          {getServiceCategory(tx.data_plan) === "nin" ? (
                            <ShieldCheck className="h-4 w-4 text-primary" />
                          ) : (
                            <CreditCard className="h-4 w-4 text-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {serviceLabels[tx.data_plan || ""] || tx.data_plan || "Verification"}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(tx.created_at)} • {formatTime(tx.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold">-₦{tx.amount.toLocaleString()}</p>
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            tx.status === "completed"
                              ? "border-emerald-500/30 text-emerald-600"
                              : tx.status === "failed"
                              ? "border-destructive/30 text-destructive"
                              : "border-yellow-500/30 text-yellow-600"
                          }`}
                        >
                          {tx.status === "completed" ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> : <XCircle className="h-2.5 w-2.5 mr-0.5" />}
                          {tx.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>

          {/* Selected Transaction Detail / Reprint */}
          {selectedTx && selectedTx.status === "completed" && selectedTx.api_response && (
            <Card className="border-primary/20 animate-fade-in">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Slip Preview — {serviceLabels[selectedTx.data_plan || ""] || "Verification"}
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedTx(null)}>✕</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div ref={printRef}>
                  <div style={{
                    width: "100%", maxWidth: "480px", margin: "0 auto",
                    background: "white", border: "2px solid #0a4d27",
                    borderRadius: "10px", padding: "24px", fontFamily: "'Segoe UI', sans-serif",
                  }}>
                    <div style={{ textAlign: "center", borderBottom: "2px solid #0a4d27", paddingBottom: "12px", marginBottom: "16px" }}>
                      <div style={{ fontSize: "10px", letterSpacing: "2px", color: "#666" }}>FEDERAL REPUBLIC OF NIGERIA</div>
                      <div style={{ fontSize: "16px", fontWeight: "bold", color: "#0a4d27", marginTop: "4px" }}>
                        {getServiceCategory(selectedTx.data_plan) === "bvn" ? "BVN" : "NIN"} VERIFICATION SLIP
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "20px" }}>
                      {selectedTx.api_response.photo && (
                        <img
                          src={selectedTx.api_response.photo.startsWith("data:") ? selectedTx.api_response.photo : `data:image/jpeg;base64,${selectedTx.api_response.photo}`}
                          alt="Photo"
                          style={{ width: "90px", height: "110px", objectFit: "cover", border: "2px solid #0a4d27", borderRadius: "6px" }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
                          <tbody>
                            {([
                              ["Full Name", selectedTx.api_response.full_name],
                              ["NIN", selectedTx.api_response.nin],
                              ["BVN", selectedTx.api_response.bvn],
                              ["Gender", selectedTx.api_response.gender],
                              ["DOB", selectedTx.api_response.date_of_birth],
                              ["Phone", selectedTx.api_response.phone],
                              ["Email", selectedTx.api_response.email],
                              ["State", selectedTx.api_response.state_of_origin],
                              ["Nationality", selectedTx.api_response.nationality],
                            ] as [string, string | undefined][]).filter(([, val]) => val).map(([label, value]) => (
                              <tr key={label}>
                                <td style={{ padding: "3px 8px 3px 0", color: "#666", whiteSpace: "nowrap", fontSize: "11px" }}>{label}:</td>
                                <td style={{ padding: "3px 0", fontWeight: "600" }}>{value}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <div style={{ marginTop: "14px", borderTop: "1px solid #ddd", paddingTop: "8px", textAlign: "center", fontSize: "8px", color: "#999" }}>
                      Powered by THE EAGLES VTU • {formatDate(selectedTx.created_at)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Button size="sm" onClick={handlePrintSelected}>
                    <Printer className="h-4 w-4 mr-2" />Re-Print
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    handlePrintSelected();
                    toast({ title: "Save as PDF", description: "Select 'Save as PDF' in print dialog" });
                  }}>
                    <Download className="h-4 w-4 mr-2" />Save PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </PageTransition>
  );
};

export default VerificationHistory;
