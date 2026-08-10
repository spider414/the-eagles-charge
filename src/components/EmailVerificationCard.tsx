import { useEffect, useState } from "react";
import { Mail, ShieldCheck, ShieldAlert, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";

interface Status {
  email: string | null;
  verified: boolean;
  pending: { new_email: string; expires_at: string } | null;
}

const EmailVerificationCard = ({ onVerified }: { onVerified?: () => void }) => {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const [changing, setChanging] = useState(false);

  const suggestion = getEmailSuggestion(newEmail);

  const call = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("change-email", { body });
    if (error) {
      // Surface the server's message rather than the generic edge error
      let message = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) message = (await ctx.clone().json())?.error ?? message;
      } catch { /* keep default message */ }
      throw new Error(message);
    }
    return data as Record<string, unknown>;
  };

  const loadStatus = async () => {
    try {
      const data = (await call({ action: "status" })) as unknown as Status;
      setStatus(data);
      if (data.pending) setNewEmail(data.pending.new_email);
      if (data.verified && !data.pending) {
        setChanging(false);
        setNewEmail("");
      }
    } catch (e) {
      console.error("email status error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (action: "send" | "resend", explicit?: string) => {
    const target = (
      explicit ??
      (action === "resend"
        ? status?.pending?.new_email ?? newEmail
        : newEmail.trim() || status?.email || "")
    ).trim();
    if (!isValidEmail(target)) {
      toast({ title: "Invalid email", description: "Enter a valid email address.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      await call({ action, new_email: target });
      setCooldown(60);
      toast({ title: "Code sent", description: `We emailed a 6-digit code to ${target}.` });
      await loadStatus();
    } catch (e) {
      toast({
        title: "Could not send code",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await call({ action: "verify", code: code.trim() });
      setCode("");
      toast({ title: "Email verified", description: "Your email address has been updated." });
      await loadStatus();
      onVerified?.();
    } catch (e) {
      toast({
        title: "Verification failed",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="h-4 w-4 text-muted-foreground" />
          Email Address
        </CardTitle>
        <CardDescription>Change the email used for receipts and account notices</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Current email</p>
                <p className="truncate text-sm font-medium">{status?.email || "Not set"}</p>
              </div>
              {status?.email && status.verified ? (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              ) : (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  <ShieldAlert className="h-3 w-3" /> Unverified
                </span>
              )}
            </div>

            {status?.email && !status.verified && !status.pending && (
              <Button
                variant="outline"
                className="w-full"
                disabled={busy || cooldown > 0}
                onClick={() => sendCode("send", status.email ?? undefined)}
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
              </Button>
            )}

            {status?.email && status.verified && !status.pending && !changing && (
              <Button variant="outline" className="w-full" onClick={() => setChanging(true)}>
                <Mail className="mr-2 h-4 w-4" /> Change email
              </Button>
            )}

            {(!status?.verified || status?.pending || changing) && (
            <div className="space-y-2">
              <Label htmlFor="new_email">New email address</Label>
              <Input
                id="new_email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={255}
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {suggestion && (
                <button
                  type="button"
                  onClick={() => setNewEmail(suggestion)}
                  className="text-xs text-primary hover:underline"
                >
                  Did you mean {suggestion}?
                </button>
              )}
              <Button
                className="w-full"
                disabled={busy || cooldown > 0 || !newEmail.trim()}
                onClick={() => sendCode("send")}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {cooldown > 0 ? `Send code in ${cooldown}s` : "Send verification code"}
                  </>
                )}
              </Button>
              {changing && (
                <Button variant="ghost" className="w-full" onClick={() => { setChanging(false); setNewEmail(""); }}>
                  Cancel
                </Button>
              )}
            </div>
            )}

            {status?.pending && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to <strong>{status.pending.new_email}</strong>. It expires in 15 minutes.
                </p>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
                <div className="flex gap-2">
                  <Button className="flex-1" disabled={busy || code.length !== 6} onClick={verify}>
                    Verify email
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || cooldown > 0}
                    onClick={() => sendCode("resend")}
                  >
                    {cooldown > 0 ? `${cooldown}s` : "Resend"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default EmailVerificationCard;