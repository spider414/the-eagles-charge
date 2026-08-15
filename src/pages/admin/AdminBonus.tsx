import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminBonus() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [id, setId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [amount, setAmount] = useState("2000");
  const [popupEnabled, setPopupEnabled] = useState(true);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupVersion, setPopupVersion] = useState(1);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("id, registration_bonus_enabled, registration_bonus_amount, bonus_popup_enabled, bonus_popup_message, bonus_popup_version")
      .limit(1)
      .maybeSingle();
    if (error) {
      toast({ title: "Could not load settings", description: error.message, variant: "destructive" });
    } else if (data) {
      setId(data.id);
      setEnabled(data.registration_bonus_enabled);
      setAmount(String(Number(data.registration_bonus_amount)));
      setPopupEnabled(!!data.bonus_popup_enabled);
      setPopupMessage(data.bonus_popup_message ?? "");
      setPopupVersion(Number(data.bonus_popup_version ?? 1));
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const savePopup = async (announceAgain: boolean) => {
    if (!id) return;
    setSaving(true);
    const nextVersion = announceAgain ? popupVersion + 1 : popupVersion;
    const { error } = await supabase
      .from("app_settings")
      .update({
        bonus_popup_enabled: popupEnabled,
        bonus_popup_message: popupMessage.trim() || null,
        bonus_popup_version: nextVersion,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Popup updated",
      description: announceAgain
        ? "Every user will see this announcement once more."
        : "Popup settings saved.",
    });
    load();
  };

  const save = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      toast({ title: "Invalid amount", description: "Enter a valid bonus amount.", variant: "destructive" });
      return;
    }
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ registration_bonus_enabled: enabled, registration_bonus_amount: value })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Saved", description: "Registration bonus settings updated." });
    load();
  };

  return (
    <div className="space-y-3">
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">New User Registration Bonus</CardTitle>
            <CardDescription>Applies only to accounts created after you save.</CardDescription>
          </div>
          {!loading && (
            <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "ON" : "OFF"}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label htmlFor="bonus-toggle">Registration Bonus</Label>
                <p className="text-xs text-muted-foreground">
                  {enabled ? "New users receive the bonus below." : "New users receive ₦0."}
                </p>
              </div>
              <Switch id="bonus-toggle" checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bonus-amount">Bonus Amount (₦)</Label>
              <Input
                id="bonus-amount"
                type="number"
                min={0}
                step={50}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!enabled}
              />
            </div>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes
            </Button>
            <p className="text-xs text-muted-foreground">
              Referral bonuses are separate and are not affected by this setting.
            </p>
          </>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Welcome bonus popup</CardTitle>
            <CardDescription>
              Shown once per user in the app. Dismissed popups never repeat unless you announce again.
            </CardDescription>
          </div>
          <Badge variant={popupEnabled ? "default" : "secondary"}>{popupEnabled ? "ON" : "OFF"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border p-3">
          <div>
            <Label htmlFor="popup-toggle">Show popup to users</Label>
            <p className="text-xs text-muted-foreground">
              Turn off to immediately stop the popup for everyone.
            </p>
          </div>
          <Switch id="popup-toggle" checked={popupEnabled} onCheckedChange={setPopupEnabled} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="popup-message">Message</Label>
          <Textarea
            id="popup-message"
            rows={4}
            value={popupMessage}
            onChange={(e) => setPopupMessage(e.target.value)}
            placeholder={`Leave empty to auto-generate from the bonus setting (e.g. "welcome bonus is still ₦${Number(amount) || 0}" or "the bonus has ended").`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => savePopup(false)} disabled={saving} variant="outline">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save popup
          </Button>
          <Button onClick={() => savePopup(true)} disabled={saving}>
            Save & announce to everyone again
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Announcement version: {popupVersion}</p>
      </CardContent>
    </Card>
    </div>
  );
}
