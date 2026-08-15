import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { ActivitySquare, ArrowLeft, CheckCircle2, CreditCard, Gift, LayoutDashboard, LifeBuoy, Loader2, LogIn, LogOut, Mail, Megaphone, Percent, Scale, ScanFace, ShieldAlert, ShieldCheck, ToggleLeft, UserCog, Users, XCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAdminScopes } from "@/hooks/useAdminScopes";

const items = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, end: true, scope: null },
  { title: "Users", url: "/admin/users", icon: Users, scope: "users" },
  { title: "Recovery", url: "/admin/recovery", icon: LifeBuoy, scope: "recovery" },
  { title: "Campaigns", url: "/admin/campaigns", icon: Megaphone, scope: "campaigns" },
  { title: "Email branding", url: "/admin/email", icon: Mail, scope: "email" },
  { title: "OTP audit log", url: "/admin/otp", icon: ShieldCheck, scope: "logs" },
  { title: "Activity log", url: "/admin/activity", icon: ActivitySquare, scope: "logs" },
  { title: "Roles", url: "/admin/roles", icon: UserCog, scope: "super" },
  { title: "Billing", url: "/admin/billing", icon: CreditCard, scope: "finance" },
  { title: "Reconciliation", url: "/admin/reconcile", icon: Scale, scope: "finance" },
  { title: "Registration bonus", url: "/admin/bonus", icon: Gift, scope: "finance" },
  { title: "NIN verification", url: "/admin/verification", icon: ScanFace, scope: "verification" },
  { title: "Deposit fee", url: "/admin/deposit-fee", icon: Percent, scope: "finance" },
  { title: "Deposit fee log", url: "/admin/deposit-fee-log", icon: History, scope: "finance" },
  { title: "Bonus change log", url: "/admin/bonus-log", icon: History, scope: "logs" },
  { title: "Feature flags", url: "/admin/feature-flags", icon: ToggleLeft, scope: "super" },
  { title: "Settings change log", url: "/admin/settings-log", icon: History, scope: "logs" },
];

function AdminSidebar() {
  const { can, isSuper } = useAdminScopes();
  const visible = items.filter(
    (item) => !item.scope || (item.scope === "super" ? isSuper : can(item.scope)),
  );
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      className={({ isActive }) =>
                        `flex items-center gap-2 ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "hover:bg-muted/50"}`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin();
  const { user, isLoading: authLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [claimOpen, setClaimOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isAdmin !== false || !user) return;
    let cancelled = false;
    supabase.rpc("admin_exists").then(({ data }) => {
      if (!cancelled) setClaimOpen(data === false);
    });
    return () => {
      cancelled = true;
    };
  }, [isAdmin, user]);

  const claim = async () => {
    setClaiming(true);
    setClaimResult(null);
    const { data, error } = await supabase.rpc("claim_admin");
    setClaiming(false);
    if (error || !data) {
      setClaimOpen(false);
      const message = error
        ? error.message.toLowerCase().includes("not authenticated")
          ? "Your session has expired. Please sign in again."
          : error.message
        : "Admin registration is already closed — an admin exists for this app. Ask them to grant you access.";
      setClaimResult({ ok: false, message });
      toast({
        title: "Admin registration closed",
        description: message,
        variant: "destructive",
      });
      return;
    }
    setClaimResult({ ok: true, message: "You are now the admin. Loading the admin dashboard…" });
    toast({ title: "You are now the admin", description: "Admin registration is now closed." });
    setTimeout(() => window.location.reload(), 1200);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

  if (isAdmin === null || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BrandLogo className="h-10 w-10" rounded="rounded-lg" />
            <p className="text-sm font-medium">Admin sign in required</p>
            <p className="text-xs text-muted-foreground">
              Sign in with an admin account to open the admin dashboard.
            </p>
            <Button size="sm" onClick={() => navigate("/auth", { state: { from: "/admin" } })}>
              <LogIn className="mr-1 h-4 w-4" /> Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {claimOpen
                ? "No admin has been registered yet. You can claim admin access once — after that this is permanently closed."
                : "You don't have access to this page."}
            </p>
            {claimResult && (
              <Alert variant={claimResult.ok ? "default" : "destructive"} className="text-left">
                {claimResult.ok ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertTitle>{claimResult.ok ? "Admin access granted" : "Could not claim admin"}</AlertTitle>
                <AlertDescription className="text-xs">{claimResult.message}</AlertDescription>
              </Alert>
            )}
            {claimOpen && (
              <Button size="sm" onClick={claim} disabled={claiming}>
                {claiming ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
                {claiming ? "Registering…" : "Register me as admin"}
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">Signed in as {user.email}</p>
            <Button size="sm" variant="outline" onClick={() => navigate("/dashboard", { replace: true })}>
              Back to dashboard
            </Button>
            <Button size="sm" variant="ghost" onClick={handleSignOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AdminSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-2 backdrop-blur-xl">
            <SidebarTrigger />
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} aria-label="Back to app">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <BrandLogo className="h-7 w-7" rounded="rounded-md" />
            <h1 className="text-base font-semibold">Admin</h1>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:inline">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-1 h-4 w-4" /> Log out
              </Button>
            </div>
          </header>
          <main className="flex-1 space-y-4 p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
