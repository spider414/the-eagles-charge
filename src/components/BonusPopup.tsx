import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const POPUP_KEY = "welcome_bonus";

export default function BonusPopup() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(1);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("bonus_popup_enabled, bonus_popup_message, bonus_popup_version, registration_bonus_enabled, registration_bonus_amount")
        .limit(1)
        .maybeSingle();
      if (!settings?.bonus_popup_enabled || cancelled) return;

      const amount = Number(settings.registration_bonus_amount ?? 0);
      const fallback = settings.registration_bonus_enabled
        ? `Good news! The welcome bonus is still active — new sign-ups get ₦${amount.toLocaleString()} credited instantly.`
        : "Heads up: the welcome bonus programme has ended. Thank you to everyone who joined.";

      const { data: dismissed } = await supabase
        .from("popup_dismissals")
        .select("id")
        .eq("user_id", user.id)
        .eq("popup_key", POPUP_KEY)
        .eq("version", settings.bonus_popup_version)
        .maybeSingle();
      if (dismissed || cancelled) return;

      setMessage(settings.bonus_popup_message || fallback);
      setVersion(settings.bonus_popup_version);
      setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dismiss = async () => {
    setOpen(false);
    if (!user) return;
    await supabase.from("popup_dismissals").insert({ user_id: user.id, popup_key: POPUP_KEY, version });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Gift className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-base">Welcome bonus update</DialogTitle>
          <DialogDescription className="text-center text-sm">{message}</DialogDescription>
        </DialogHeader>
        <Button onClick={dismiss} className="w-full">
          Got it
        </Button>
      </DialogContent>
    </Dialog>
  );
}
