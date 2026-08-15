import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, EyeOff, Loader2, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ADMIN_SCOPES, scopeLabel, useAdminScopes } from "@/hooks/useAdminScopes";

type Row = {
  user_id: string;
  full_name: string | null;
  phone_number: string | null;
  contact_email: string | null;
  scopes: string[];
  isAdmin: boolean;
};

export default function AdminRoles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isSuper, loading: scopesLoading } = useAdminScopes();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [target, setTarget] = useState<Row | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone_number: "", contact_email: "", password: "" });
  const [formScopes, setFormScopes] = useState<string[]>(["users"]);
  const [showPassword, setShowPassword] = useState(false);
  const [creating, setCreating] = useState(false);

  const toggleFormScope = (key: string, checked: boolean) => {
    setFormScopes((prev) => {
      if (key === "all") return checked ? ["all"] : [];
      const next = checked ? [...prev.filter((s) => s !== "all"), key] : prev.filter((s) => s !== key);
      return Array.from(new Set(next));
    });
  };

  const createAdmin = async () => {
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-admin", {
      body: { ...form, scopes: formScopes },
    });
    setCreating(false);
    const message = (data as any)?.error || error?.message;
    if (message) {
      toast({ title: "Could not register admin", description: message, variant: "destructive" });
      return;
    }
    toast({
      title: (data as any)?.created ? "Admin account created" : "Existing user promoted to admin",
      description: `They can now log in with ${form.phone_number} and the password you set.`,
    });
    setForm({ full_name: "", phone_number: "", contact_email: "", password: "" });
    setFormScopes(["users"]);
    load();
  };

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: roles }, { data: scopeRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, phone_number, contact_email")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("user_roles").select("user_id, role").eq("role", "admin"),
      supabase.from("admin_scopes").select("user_id, scope"),
    ]);
    const adminIds = new Set((roles ?? []).map((r) => r.user_id));
    const scopeMap = new Map<string, string[]>();
    for (const s of scopeRows ?? []) {
      scopeMap.set(s.user_id, [...(scopeMap.get(s.user_id) ?? []), s.scope]);
    }
    setRows(
      (profiles ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone_number: p.phone_number,
        contact_email: p.contact_email,
        scopes: scopeMap.get(p.user_id) ?? [],
        isAdmin: adminIds.has(p.user_id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const admins = useMemo(() => rows.filter((r) => r.isAdmin), [rows]);
  const term = q.trim().toLowerCase();
  const matches = useMemo(
    () =>
      term
        ? rows
            .filter((r) =>
              [r.full_name, r.phone_number, r.contact_email, r.user_id].some((v) =>
                (v ?? "").toLowerCase().includes(term),
              ),
            )
            .slice(0, 15)
        : [],
    [rows, term],
  );

  const openEditor = (row: Row) => {
    setTarget(row);
    setDraft(row.scopes.length ? row.scopes : ["users"]);
  };

  const toggleDraft = (key: string, checked: boolean) => {
    setDraft((prev) => {
      if (key === "all") return checked ? ["all"] : [];
      const next = checked ? [...prev.filter((s) => s !== "all"), key] : prev.filter((s) => s !== key);
      return Array.from(new Set(next));
    });
  };

  const save = async (scopes: string[]) => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_set_scopes", {
      _user_id: target.user_id,
      _scopes: scopes,
    });
    setBusy(false);
    if (error) {
      toast({ title: "Could not update admin", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: scopes.length ? "Admin duties saved" : "Admin access revoked",
      description: target.full_name || target.contact_email || target.phone_number || target.user_id,
    });
    setTarget(null);
    load();
  };

  if (scopesLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuper) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Only the general admin can add admins or change what they are in charge of.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Admin team ({admins.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : admins.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No admins yet.</p>
          ) : (
            admins.map((r) => (
              <div key={r.user_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {r.full_name || r.phone_number || "Unnamed user"}
                    {r.user_id === user?.id && <span className="ml-1 text-muted-foreground">(you)</span>}
                  </p>
                  <p className="truncate text-muted-foreground">{r.contact_email || r.phone_number || r.user_id}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(r.scopes.length ? r.scopes : ["users"]).map((s) => (
                      <Badge key={s} variant={s === "all" ? "default" : "secondary"} className="text-[10px]">
                        {scopeLabel(s)}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={r.user_id === user?.id}
                  onClick={() => openEditor(r)}
                  title={r.user_id === user?.id ? "You cannot change your own duties" : undefined}
                >
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Manage duties
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Create a brand new admin account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Use this when the person does not have the app yet. You create the account for them and give them the
            login details.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Full name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Chidi Okeke"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Phone number (their login)</Label>
              <Input
                value={form.phone_number}
                onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
                placeholder="08012345678"
                inputMode="tel"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email (optional, we send the details there)</Label>
              <Input
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="name@example.com"
                type="email"
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Temporary password</Label>
              <div className="relative">
                <Input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  type={showPassword ? "text" : "password"}
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">What will they be in charge of?</Label>
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {ADMIN_SCOPES.map((s) => (
                <label key={s.key} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                  <Checkbox
                    checked={formScopes.includes(s.key)}
                    onCheckedChange={(v) => toggleFormScope(s.key, v === true)}
                  />
                  <Label className="cursor-pointer text-xs font-normal">{s.label}</Label>
                </label>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={
              creating ||
              formScopes.length === 0 ||
              form.full_name.trim().length < 2 ||
              form.phone_number.replace(/\D/g, "").length < 10 ||
              form.password.length < 8
            }
            onClick={createAdmin}
          >
            {creating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <UserPlus className="mr-1 h-3.5 w-3.5" />}
            Create admin account
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Make an existing user an admin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Search for the person, then choose the work they will be in charge of (for example verification only).
          </p>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, phone, email or user id"
            className="h-9"
          />
          {term && (
            <div className="space-y-2">
              {matches.map((r) => (
                <div key={r.user_id} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2.5 text-xs">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.full_name || r.phone_number || "Unnamed user"}</p>
                    <p className="truncate text-muted-foreground">{r.contact_email || r.phone_number || r.user_id}</p>
                  </div>
                  {r.isAdmin && <Badge variant="secondary">Admin</Badge>}
                  <Button size="sm" disabled={r.user_id === user?.id} onClick={() => openEditor(r)}>
                    <UserPlus className="mr-1 h-3.5 w-3.5" /> {r.isAdmin ? "Edit duties" : "Assign duties"}
                  </Button>
                </div>
              ))}
              {matches.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No users found.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base">
              {target?.full_name || target?.contact_email || target?.phone_number || "Admin"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Pick what this admin is in charge of. Only the areas you tick will appear in their admin menu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {ADMIN_SCOPES.map((s) => (
              <label key={s.key} className="flex items-center gap-2 rounded-md border border-border p-2 text-xs">
                <Checkbox
                  checked={draft.includes(s.key)}
                  onCheckedChange={(v) => toggleDraft(s.key, v === true)}
                />
                <Label className="cursor-pointer text-xs font-normal">{s.label}</Label>
              </label>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {target?.isAdmin && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => save([])}>
                <ShieldOff className="mr-1 h-3.5 w-3.5" /> Revoke admin
              </Button>
            )}
            <Button size="sm" disabled={busy || draft.length === 0} onClick={() => save(draft)}>
              {busy && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />} Save duties
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
