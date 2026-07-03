import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Palette, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Branding = {
  id?: string;
  brand_name: string;
  logo_url: string | null;
  logo_emoji: string | null;
  primary_color: string;
  dark_color: string;
  header_tagline: string | null;
  footer_text: string | null;
  support_email: string;
  from_address: string;
};

type Template = {
  id: string;
  template_key: string;
  subject: string;
  intro: string;
  outro: string;
  enabled: boolean;
};

const LABELS: Record<string, string> = {
  welcome: "Welcome email",
  receipt: "Payment receipt",
  password_reset: "Password reset",
};

export default function AdminEmailBranding() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branding, setBranding] = useState<Branding | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!role) {
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      const [{ data: b }, { data: t }] = await Promise.all([
        supabase.from("email_settings").select("*").limit(1).maybeSingle(),
        supabase.from("email_templates").select("*").order("template_key"),
      ]);
      if (b) setBranding(b as Branding);
      if (t) setTemplates(t as Template[]);
      setLoading(false);
    })();
  }, [user]);

  const saveBranding = async () => {
    if (!branding?.id) return;
    setSaving(true);
    const { id, ...rest } = branding;
    const { error } = await supabase.from("email_settings").update(rest).eq("id", id);
    setSaving(false);
    toast({
      title: error ? "Save failed" : "Branding saved",
      description: error?.message,
      variant: error ? "destructive" : "default",
    });
  };

  const saveTemplate = async (tpl: Template) => {
    setSaving(true);
    const { id, ...rest } = tpl;
    const { error } = await supabase.from("email_templates").update(rest).eq("id", id);
    setSaving(false);
    toast({
      title: error ? "Save failed" : `${LABELS[tpl.template_key]} saved`,
      description: error?.message,
      variant: error ? "destructive" : "default",
    });
  };

  if (loading) return null;
  if (!isAdmin) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Admin • Email Templates & Branding
        </CardTitle>
        <CardDescription>Customise how welcome, receipt, and password reset emails look.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {branding && (
          <div className="space-y-3">
            <h3 className="font-semibold">Brand</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Brand name</Label>
                <Input value={branding.brand_name} onChange={(e) => setBranding({ ...branding, brand_name: e.target.value })} />
              </div>
              <div>
                <Label>Logo emoji (fallback)</Label>
                <Input value={branding.logo_emoji ?? ""} onChange={(e) => setBranding({ ...branding, logo_emoji: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Logo URL</Label>
                <Input placeholder="https://…/logo.png" value={branding.logo_url ?? ""} onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })} />
              </div>
              <div>
                <Label>Primary color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-14 p-1" value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
                  <Input value={branding.primary_color} onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Dark color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-14 p-1" value={branding.dark_color} onChange={(e) => setBranding({ ...branding, dark_color: e.target.value })} />
                  <Input value={branding.dark_color} onChange={(e) => setBranding({ ...branding, dark_color: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Header tagline</Label>
                <Input value={branding.header_tagline ?? ""} onChange={(e) => setBranding({ ...branding, header_tagline: e.target.value })} />
              </div>
              <div>
                <Label>Support email</Label>
                <Input value={branding.support_email} onChange={(e) => setBranding({ ...branding, support_email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>From address</Label>
                <Input value={branding.from_address} onChange={(e) => setBranding({ ...branding, from_address: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <Label>Footer text</Label>
                <Textarea rows={2} value={branding.footer_text ?? ""} onChange={(e) => setBranding({ ...branding, footer_text: e.target.value })} />
              </div>
            </div>
            <Button onClick={saveBranding} disabled={saving} size="sm">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save branding
            </Button>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold">Templates</h3>
          {templates.map((t) => (
            <div key={t.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-medium">{LABELS[t.template_key] ?? t.template_key}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Enabled</span>
                  <Switch
                    checked={t.enabled}
                    disabled={t.template_key === "password_reset" || t.template_key === "receipt"}
                    onCheckedChange={(v) => setTemplates(templates.map((x) => (x.id === t.id ? { ...x, enabled: v } : x)))}
                  />
                </div>
              </div>
              <div>
                <Label>Subject</Label>
                <Input value={t.subject} onChange={(e) => setTemplates(templates.map((x) => (x.id === t.id ? { ...x, subject: e.target.value } : x)))} />
              </div>
              <div>
                <Label>Intro</Label>
                <Textarea rows={2} value={t.intro} onChange={(e) => setTemplates(templates.map((x) => (x.id === t.id ? { ...x, intro: e.target.value } : x)))} />
              </div>
              <div>
                <Label>Outro</Label>
                <Textarea rows={2} value={t.outro} onChange={(e) => setTemplates(templates.map((x) => (x.id === t.id ? { ...x, outro: e.target.value } : x)))} />
              </div>
              <Button size="sm" onClick={() => saveTemplate(t)} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Receipt and password reset templates cannot be disabled — they are essential for security and compliance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}