import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, MailX, Check } from "lucide-react";
import { SUPABASE_PROJECT_ID } from "@/lib/supabaseEnv";

const FN_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/email-unsubscribe`;

type Prefs = {
  email_marketing_opt_in: boolean;
  email_promotions_opt_in: boolean;
  email_product_updates_opt_in: boolean;
};

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>({
    email_marketing_opt_in: true,
    email_promotions_opt_in: true,
    email_product_updates_opt_in: true,
  });

  useEffect(() => {
    if (!token) {
      setError("Missing unsubscribe token");
      setLoading(false);
      return;
    }
    fetch(`${FN_URL}?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setPrefs(d);
      })
      .catch(() => setError("Failed to load preferences"))
      .finally(() => setLoading(false));
  }, [token]);

  const save = async (all: boolean) => {
    setSaving(true);
    const body = all
      ? { token }
      : { token, preferences: prefs };
    const res = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) setDone(true);
    else setError("Could not update preferences");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MailX className="h-5 w-5" /> Email Preferences
          </CardTitle>
          <CardDescription>
            Manage which emails you receive from HARMIC RECHARGE. Password reset and payment receipt emails are always sent.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : done ? (
            <div className="flex items-center gap-2 text-primary"><Check className="h-5 w-5" /> Preferences updated.</div>
          ) : (
            <>
              {([
                ["email_marketing_opt_in", "Welcome & marketing"],
                ["email_promotions_opt_in", "Promotions & offers"],
                ["email_product_updates_opt_in", "Product updates"],
              ] as const).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={prefs[k]}
                    onCheckedChange={(v) => setPrefs({ ...prefs, [k]: v })}
                  />
                </div>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => save(false)} disabled={saving}>Save preferences</Button>
                <Button variant="outline" onClick={() => save(true)} disabled={saving}>Unsubscribe from all non-essential</Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}