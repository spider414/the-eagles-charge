import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Building2,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PageTransition from "@/components/PageTransition";

interface TinTransaction {
  id: string;
  user_id: string;
  user_display: string;
  amount: number;
  status: string;
  data_plan: string;
  api_response: any;
  phone_number: string;
  created_at: string;
  description: string;
}

const AdminTin = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [requests, setRequests] = useState<TinTransaction[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [tinInputs, setTinInputs] = useState<Record<string, string>>({});
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) checkAdminAndLoad();
  }, [user]);

  const checkAdminAndLoad = async () => {
    if (!user) return;
    // Check role client-side first
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      setIsAdmin(false);
      return;
    }
    setIsAdmin(true);
    await loadRequests();
  };

  const loadRequests = async () => {
    setIsLoadingData(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-tin", {
        body: { action: "list" },
      });
      if (error) throw error;
      if (data?.success) {
        setRequests(data.data || []);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load TIN requests", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleComplete = async (txnId: string) => {
    const tin = tinInputs[txnId]?.trim();
    if (!tin) {
      toast({ title: "TIN Required", description: "Please enter the TIN number", variant: "destructive" });
      return;
    }

    setUpdatingIds((prev) => new Set(prev).add(txnId));
    try {
      const { data, error } = await supabase.functions.invoke("admin-tin", {
        body: { action: "complete", transaction_id: txnId, tin_number: tin },
      });
      if (error) throw error;
      if (data?.success) {
        toast({ title: "Success", description: "TIN updated and status set to completed" });
        setTinInputs((prev) => ({ ...prev, [txnId]: "" }));
        await loadRequests();
      } else {
        toast({ title: "Error", description: data?.error || "Update failed", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to update", variant: "destructive" });
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(txnId);
        return next;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case "processing":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case "failed":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading || isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  if (isAdmin === false) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="max-w-sm mx-auto">
            <CardContent className="p-8 text-center space-y-4">
              <ShieldCheck className="h-12 w-12 text-destructive mx-auto" />
              <h2 className="text-xl font-bold">Access Denied</h2>
              <p className="text-sm text-muted-foreground">You do not have admin privileges to access this page.</p>
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </CardContent>
          </Card>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
                  <ShieldCheck className="h-5 w-5 text-destructive" />
                </div>
                <span className="text-lg font-bold text-foreground">TIN Admin</span>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadRequests} disabled={isLoadingData}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${isLoadingData ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </header>

        <main className="container py-6 pb-8 space-y-4 max-w-2xl mx-auto">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold text-foreground">TIN Request Management</h1>
            <p className="text-sm text-muted-foreground">Review and complete TIN registration/retrieval requests</p>
          </div>

          <div className="flex items-center justify-between bg-muted/50 rounded-xl px-4 py-2.5">
            <span className="text-sm text-muted-foreground">Total Requests</span>
            <Badge variant="outline" className="font-bold">{requests.length}</Badge>
          </div>

          {requests.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center text-muted-foreground">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No TIN requests found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const apiRes = req.api_response || {};
                const isIndividual = req.data_plan === "tin-individual";
                const isProcessing = req.status === "processing";

                return (
                  <Card key={req.id} className={isProcessing ? "border-amber-500/30" : ""}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isIndividual ? (
                            <User className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-semibold capitalize">
                            {isIndividual ? "Individual" : "Corporate"}
                          </span>
                          <span className="text-xs text-muted-foreground">• ₦{req.amount}</span>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><span className="text-muted-foreground">User:</span> <span className="font-medium">{req.user_display}</span></div>
                        <div><span className="text-muted-foreground">Date:</span> <span className="font-medium">{new Date(req.created_at).toLocaleDateString()}</span></div>
                        {apiRes.full_name && <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{apiRes.full_name}</span></div>}
                        {apiRes.nin && <div><span className="text-muted-foreground">NIN:</span> <span className="font-mono font-medium">{apiRes.nin}</span></div>}
                        {apiRes.business_name && <div className="col-span-2"><span className="text-muted-foreground">Business:</span> <span className="font-medium">{apiRes.business_name}</span></div>}
                        {apiRes.rc_number && <div><span className="text-muted-foreground">RC:</span> <span className="font-mono font-medium">{apiRes.rc_number}</span></div>}
                        {apiRes.phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{apiRes.phone}</span></div>}
                        {apiRes.contact_phone && <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{apiRes.contact_phone}</span></div>}
                        {apiRes.tin && (
                          <div className="col-span-2 bg-emerald-500/10 rounded-lg p-2 text-center">
                            <span className="text-emerald-600 font-bold font-mono text-sm">TIN: {apiRes.tin}</span>
                          </div>
                        )}
                      </div>

                      {isProcessing && (
                        <div className="flex items-end gap-2 pt-1">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Enter TIN Number</Label>
                            <Input
                              placeholder="e.g. 12345678-0001"
                              value={tinInputs[req.id] || ""}
                              onChange={(e) => setTinInputs((prev) => ({ ...prev, [req.id]: e.target.value }))}
                              className="h-9 text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleComplete(req.id)}
                            disabled={updatingIds.has(req.id)}
                            className="h-9"
                          >
                            {updatingIds.has(req.id) ? (
                              <Clock className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <><Send className="h-3.5 w-3.5 mr-1" />Complete</>
                            )}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </PageTransition>
  );
};

export default AdminTin;
