import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Row = {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  contact_email: string | null;
  isAdmin: boolean;
};

export default function AdminRoles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, phone_number, contact_email")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
    ]);
    const adminIds = new Set((roles ?? []).map((r) => r.user_id));
    setRows(
      (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone_number: p.phone_number,
        contact_email: p.contact_email,
        isAdmin: adminIds.has(p.user_id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (row: Row) => {
    setBusy(row.user_id);
    const { error } = row.isAdmin
      ? await supabase.from("user_roles").delete().eq("user_id", row.user_id).eq("role", "admin")
      : await supabase.from("user_roles").insert({ user_id: row.user_id, role: "admin" });
    setBusy(null);
    if (error) {
      toast({ title: "Role update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: row.isAdmin ? "Admin role revoked" : "Admin role granted",
      description: row.full_name || row.phone_number || row.user_id,
    });
    load();
  };

  const term = q.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      !term ||
      [r.full_name, r.phone_number, r.contact_email, r.user_id].some((v) =>
        (v ?? "").toLowerCase().includes(term),
      ),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Role management</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, email or user id"
          className="h-9"
        />
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map((r) => {
              const isSelf = r.user_id === user?.id;
              return (
                <div
                  key={r.user_id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {r.full_name || r.phone_number || "Unnamed user"}
                    </p>
                    <p className="truncate text-muted-foreground">
                      {r.contact_email || r.phone_number || r.user_id}
                    </p>
                  </div>
                  {r.isAdmin && <Badge variant="secondary">Admin</Badge>}
                  <Button
                    size="sm"
                    variant={r.isAdmin ? "outline" : "default"}
                    disabled={isSelf || busy === r.user_id}
                    onClick={() => toggle(r)}
                    title={isSelf ? "You cannot change your own role" : undefined}
                  >
                    {busy === r.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : r.isAdmin ? (
                      <>
                        <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Make admin
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
            {visible.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No users found.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
