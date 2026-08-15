import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, CheckCheck, Gift, Heart, Megaphone, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";

type Filter = "all" | "bonus" | "apology" | "campaign";

const iconFor = (type: string) => {
  if (type.includes("bonus")) return Gift;
  if (type.includes("apolog") || type.includes("recovery")) return Heart;
  if (type.includes("campaign") || type.includes("promo")) return Megaphone;
  if (type.includes("wallet")) return Wallet;
  return Bell;
};

const categoryOf = (n: { type: string; title: string; body: string }): Filter | "other" => {
  const t = `${n.type} ${n.title} ${n.body}`.toLowerCase();
  if (t.includes("bonus")) return "bonus";
  if (t.includes("sorry") || t.includes("apolog") || t.includes("refund")) return "apology";
  if (t.includes("promo") || t.includes("campaign") || t.includes("offer")) return "campaign";
  return "other";
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, isLoading, markAllAsRead, refresh } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [dismissals, setDismissals] = useState<{ popup_key: string; version: number; created_at: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("popup_dismissals")
      .select("popup_key, version, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setDismissals(data ?? []));
  }, [user]);

  const visible = useMemo(
    () => notifications.filter((n) => filter === "all" || categoryOf(n) === filter),
    [notifications, filter],
  );

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex-1 text-base font-semibold">Message history</h1>
        <Button variant="ghost" size="sm" onClick={markAllAsRead}>
          <CheckCheck className="mr-1 h-4 w-4" /> Read all
        </Button>
      </header>

      <main className="mx-auto max-w-2xl space-y-3 p-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="bonus">Bonus</TabsTrigger>
            <TabsTrigger value="apology">Apology</TabsTrigger>
            <TabsTrigger value="campaign">Offers</TabsTrigger>
          </TabsList>
        </Tabs>

        {dismissals.length > 0 && filter !== "apology" && filter !== "campaign" && (
          <Card>
            <CardContent className="space-y-1 p-3">
              <p className="text-xs font-medium text-muted-foreground">Pop-up messages you dismissed</p>
              {dismissals.map((d) => (
                <p key={`${d.popup_key}-${d.version}`} className="text-xs text-muted-foreground">
                  {d.popup_key.replace(/_/g, " ")} (v{d.version}) — dismissed{" "}
                  {new Date(d.created_at).toLocaleDateString()}
                </p>
              ))}
            </CardContent>
          </Card>
        )}

        {isLoading && <p className="p-6 text-center text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && visible.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-40" />
            No messages here yet.
          </div>
        )}

        {visible.map((n) => {
          const Icon = iconFor(`${n.type} ${n.title}`.toLowerCase());
          return (
            <Card key={n.id} className={n.read ? undefined : "border-primary/40"}>
              <CardContent className="flex gap-3 p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{n.title}</p>
                    {!n.read && <Badge variant="secondary" className="text-[10px]">New</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString()} · {n.read ? "Read" : "Unread"}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Button variant="outline" size="sm" className="w-full" onClick={refresh}>
          Refresh
        </Button>
      </main>
    </div>
  );
}
