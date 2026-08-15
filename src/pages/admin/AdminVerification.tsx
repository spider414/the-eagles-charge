import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminVerification() {
  const { toast } = useToast();
  const [id, setId] = useState<string | null>(null);
  const [required, setRequired] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("id, nin_verification_required")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast({ title: "Could not load settings", description: error.message, variant: "destructive" });
      } else if (data) {
        setId(data.id);
        setRequired(data.nin_verification_required !== false);
      }
      setLoading(false);
    })();
  }, [toast]);

  const save = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .update({ nin_verification_required: required })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Saved",
      description: required
        ? "New users must verify their NIN and use their NIN name."
        : "NIN verification is now optional for new users.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">NIN verification at signup</CardTitle>
          <CardDescription>
            Replaces BVN checks. The NIN linked to the phone number is looked up and the name on the
            NIN must match the name the user types, so one person cannot open many accounts to farm
            the welcome bonus.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="nin-required">Require NIN verification</Label>
              <p className="text-xs text-muted-foreground">
                Turn this off temporarily if many users are struggling to register.
              </p>
            </div>
            <Switch id="nin-required" checked={required} onCheckedChange={setRequired} />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              When off, users can skip identity verification and register with any name. Existing
              accounts are never affected.
            </AlertDescription>
          </Alert>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save setting
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
