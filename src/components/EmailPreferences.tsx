import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Prefs = {
  email_marketing_opt_in: boolean;
  email_promotions_opt_in: boolean;
  email_product_updates_opt_in: boolean;
};

const ROWS: { key: keyof Prefs; title: string; desc: string }[] = [
  { key: "email_marketing_opt_in", title: "Welcome & marketing", desc: "Onboarding tips and news about The Eagles Charge." },
  { key: "email_promotions_opt_in", title: "Promotions & offers", desc: "Discounts, cashback and referral campaigns." },
  { key: "email_product_updates_opt_in", title: "Product updates", desc: "New features, service outages and improvements." },
];

export default function EmailPreferences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("email_marketing_opt_in, email_promotions_opt_in, email_product_updates_opt_in")
        .eq("id", user.id)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
    })();
  }, [user]);

  const update = async (key: keyof Prefs, value: boolean) => {
    if (!user || !prefs) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ [key]: value }).eq("id", user.id);
    setSaving(false);
    if (error) {
      setPrefs(prefs);
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Preferences
        </CardTitle>
        <CardDescription>
          Choose which non-essential emails you'd like to receive. Password resets and payment receipts are always sent for your security.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {ROWS.map((row, i) => (
          <div key={row.key} className={`flex items-center justify-between py-3 ${i > 0 ? "border-t border-border" : ""}`}>
            <div className="pr-4">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.desc}</p>
            </div>
            <Switch
              checked={prefs?.[row.key] ?? true}
              disabled={!prefs || saving}
              onCheckedChange={(v) => update(row.key, v)}
            />
          </div>
        ))}
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            🔒 Required: password reset and payment receipt emails are always delivered.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}