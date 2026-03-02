import { useEffect } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * Toggle component for enabling/disabling push notifications in Settings
 */
const PushNotificationToggle = () => {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();

  if (!isSupported || !user) return null;

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      const success = await subscribe();
      if (success) {
        toast({ title: "Notifications Enabled", description: "You'll receive push notifications even when the app is closed." });
      } else if (permission === "denied") {
        toast({ title: "Permission Denied", description: "Please enable notifications in your browser settings.", variant: "destructive" });
      }
    } else {
      await unsubscribe();
      toast({ title: "Notifications Disabled", description: "You won't receive push notifications anymore." });
    }
  };

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        {isSubscribed ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
        <div>
          <Label className="text-sm font-medium">Push Notifications</Label>
          <p className="text-xs text-muted-foreground">Receive alerts even when app is closed</p>
        </div>
      </div>
      <Switch checked={isSubscribed} onCheckedChange={handleToggle} />
    </div>
  );
};

export default PushNotificationToggle;
