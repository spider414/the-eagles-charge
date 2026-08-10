import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminEmailBranding from "@/components/AdminEmailBranding";
import AdminOtpAuditLog from "@/components/AdminOtpAuditLog";

const Admin = () => {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      if (isLoading) return;
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!data);
    };
    check();
  }, [user, isLoading]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container flex h-14 items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold">Admin</h1>
        </div>
      </header>

      <main className="container space-y-4 py-4">
        {isAdmin === null && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {isAdmin === false && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <ShieldAlert className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You don't have access to this page.
              </p>
              <Button size="sm" onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <>
            <AdminEmailBranding />
            <AdminOtpAuditLog />
          </>
        )}
      </main>
    </div>
  );
};

export default Admin;