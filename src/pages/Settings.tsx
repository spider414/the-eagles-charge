import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bird,
  ArrowLeft,
  Moon,
  Sun,
  Bell,
  Shield,
  HelpCircle,
  FileText,
  LogOut,
  ChevronRight,
  Smartphone,
  Fingerprint,
  Vibrate,
  Volume2,
  Zap,
  Wallet,
  Phone,
  Wifi,
  Receipt,
  Trash2,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";

interface SettingItem {
  icon: React.ElementType;
  label: string;
  description?: string;
  type: "toggle" | "link" | "action";
  value?: boolean;
  onClick?: () => void;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
}

const Settings = () => {
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const { checkBiometricSupport, registerBiometric, disableBiometric, isBiometricEnabled } = useBiometricAuth();
  const { testSound, playToggle } = useSoundEffects();
  
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);

  // Settings state (stored in localStorage for persistence)
  const [settings, setSettings] = useState(() => ({
    darkMode: localStorage.getItem("theme") === "dark",
    notifications: localStorage.getItem("notifications") !== "false",
    biometric: isBiometricEnabled(),
    hapticFeedback: localStorage.getItem("hapticFeedback") !== "false",
    soundEffects: localStorage.getItem("soundEffects") !== "false",
  }));

  // Notification preferences state
  const [notificationPrefs, setNotificationPrefs] = useState(() => ({
    airtime: localStorage.getItem("notify_airtime") !== "false",
    data: localStorage.getItem("notify_data") !== "false",
    bills: localStorage.getItem("notify_bills") !== "false",
    wallet: localStorage.getItem("notify_wallet") !== "false",
  }));

  useEffect(() => {
    // Check biometric support on mount
    checkBiometricSupport().then(setBiometricSupported);
  }, [checkBiometricSupport]);

  // Request push notification permission
  const requestNotificationPermission = async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      toast({
        title: "Not Supported",
        description: "Push notifications are not supported on this device.",
        variant: "destructive",
      });
      return false;
    }

    if (Notification.permission === "granted") {
      return true;
    }

    if (Notification.permission === "denied") {
      toast({
        title: "Notifications Blocked",
        description: "Please enable notifications in your browser settings.",
        variant: "destructive",
      });
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Show a test notification
      new Notification("Eagles VTU", {
        body: "Notifications enabled! You'll receive transaction alerts.",
        icon: "/favicon.ico",
      });
      return true;
    } else {
      toast({
        title: "Permission Denied",
        description: "You won't receive transaction alerts.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Trigger haptic feedback
  const triggerHaptic = (pattern: number | number[] = 50) => {
    if ("vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const updateSetting = async (key: keyof typeof settings, value: boolean) => {
    // Special handling for biometric
    if (key === "biometric") {
      if (value) {
        if (!biometricSupported) {
          toast({
            title: "Not Supported",
            description: "Biometric authentication is not available on this device.",
            variant: "destructive",
          });
          return;
        }
        
        // Register biometric
        const success = await registerBiometric(user?.id || "user");
        if (!success) return;
      } else {
        disableBiometric();
      }
    }

    // Special handling for notifications
    if (key === "notifications") {
      if (value) {
        const granted = await requestNotificationPermission();
        if (!granted) return;
      }
    }

    // Special handling for haptic feedback
    if (key === "hapticFeedback") {
      if (value) {
        if (!("vibrate" in navigator)) {
          toast({
            title: "Not Supported",
            description: "Haptic feedback is not available on this device.",
            variant: "destructive",
          });
          return;
        }
        // Test vibration when enabled
        triggerHaptic([50, 30, 50]);
      }
    }

    // Special handling for sound effects
    if (key === "soundEffects") {
      // Save first so testSound can check
      localStorage.setItem(key, value.toString());
      setSettings((prev) => ({ ...prev, [key]: value }));
      if (value) {
        testSound();
      }
      toast({
        title: "Setting Updated",
        description: `Sound effects has been ${value ? "enabled" : "disabled"}.`,
      });
      return;
    }

    setSettings((prev) => ({ ...prev, [key]: value }));
    localStorage.setItem(key, value.toString());

    if (key === "darkMode") {
      document.documentElement.classList.toggle("dark", value);
      localStorage.setItem("theme", value ? "dark" : "light");
    }

    // Trigger haptic on all toggle changes if enabled
    if (settings.hapticFeedback || (key === "hapticFeedback" && value)) {
      triggerHaptic();
    }

    // Play sound on toggle if enabled
    if (settings.soundEffects) {
      playToggle();
    }

    if (key !== "biometric") {
      toast({
        title: "Setting Updated",
        description: `${key.replace(/([A-Z])/g, " $1").trim()} has been ${value ? "enabled" : "disabled"}.`,
      });
    }
  };

  const updateNotificationPref = (key: keyof typeof notificationPrefs, value: boolean) => {
    setNotificationPrefs((prev) => ({ ...prev, [key]: value }));
    localStorage.setItem(`notify_${key}`, value.toString());

    // Trigger haptic and sound feedback
    if (settings.hapticFeedback) {
      triggerHaptic();
    }
    if (settings.soundEffects) {
      playToggle();
    }

    toast({
      title: "Preference Updated",
      description: `${key.charAt(0).toUpperCase() + key.slice(1)} notifications ${value ? "enabled" : "disabled"}.`,
    });
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const appSettings: SettingItem[] = [
    {
      icon: settings.darkMode ? Moon : Sun,
      label: "Dark Mode",
      description: "Switch between light and dark themes",
      type: "toggle",
      value: settings.darkMode,
      onChange: (value) => updateSetting("darkMode", value),
    },
    {
      icon: Bell,
      label: "Push Notifications",
      description: "Receive transaction alerts",
      type: "toggle",
      value: settings.notifications,
      onChange: (value) => updateSetting("notifications", value),
    },
    {
      icon: Volume2,
      label: "Sound Effects",
      description: "Audio feedback on actions",
      type: "toggle",
      value: settings.soundEffects,
      onChange: (value) => updateSetting("soundEffects", value),
    },
    {
      icon: Vibrate,
      label: "Haptic Feedback",
      description: "Vibration on button press",
      type: "toggle",
      value: settings.hapticFeedback,
      onChange: (value) => updateSetting("hapticFeedback", value),
    },
  ];

  const notificationTypes: SettingItem[] = [
    {
      icon: Phone,
      label: "Airtime",
      description: "Airtime purchase alerts",
      type: "toggle",
      value: notificationPrefs.airtime,
      onChange: (value) => updateNotificationPref("airtime", value),
      disabled: !settings.notifications,
    },
    {
      icon: Wifi,
      label: "Data",
      description: "Data bundle alerts",
      type: "toggle",
      value: notificationPrefs.data,
      onChange: (value) => updateNotificationPref("data", value),
      disabled: !settings.notifications,
    },
    {
      icon: Receipt,
      label: "Bills",
      description: "Electricity & cable TV alerts",
      type: "toggle",
      value: notificationPrefs.bills,
      onChange: (value) => updateNotificationPref("bills", value),
      disabled: !settings.notifications,
    },
    {
      icon: Wallet,
      label: "Wallet",
      description: "Wallet top-up & transfer alerts",
      type: "toggle",
      value: notificationPrefs.wallet,
      onChange: (value) => updateNotificationPref("wallet", value),
      disabled: !settings.notifications,
    },
  ];

  const securitySettings: SettingItem[] = [
    {
      icon: Fingerprint,
      label: "Biometric Login",
      description: biometricSupported 
        ? "Use fingerprint or face ID" 
        : "Not available on this device",
      type: "toggle",
      value: settings.biometric,
      onChange: (value) => updateSetting("biometric", value),
      disabled: !biometricSupported,
    },
    {
      icon: Shield,
      label: "Change Password",
      description: "Update your account password",
      type: "link",
      onClick: () => setChangePasswordOpen(true),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: HelpCircle,
      label: "Help & Support",
      description: "Get help with the app",
      type: "link",
      onClick: () => navigate("/support"),
    },
    {
      icon: FileText,
      label: "Terms & Conditions",
      description: "Read our terms of service",
      type: "link",
      onClick: () => navigate("/terms"),
    },
    {
      icon: FileText,
      label: "Privacy Policy",
      description: "Read our privacy policy",
      type: "link",
      onClick: () => navigate("/privacy"),
    },
  ];

  const renderSettingItem = (item: SettingItem, index: number) => (
    <div
      key={index}
      className={`flex items-center justify-between py-4 border-b border-border last:border-0 ${
        item.type === "link" || item.type === "action" ? "cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-lg" : ""
      } ${item.disabled ? "opacity-50" : ""}`}
      onClick={item.type === "link" || item.type === "action" ? item.onClick : undefined}
      role={item.type === "link" || item.type === "action" ? "button" : undefined}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-muted">
          <item.icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{item.label}</p>
          {item.description && (
            <p className="text-sm text-muted-foreground">{item.description}</p>
          )}
        </div>
      </div>
      {item.type === "toggle" ? (
        <Switch 
          checked={item.value} 
          onCheckedChange={item.onChange} 
          disabled={item.disabled}
        />
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <Bird className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="font-semibold">Settings</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-4">

        {/* App Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              App Settings
            </CardTitle>
            <CardDescription>Customize your app experience</CardDescription>
          </CardHeader>
          <CardContent>
            {appSettings.map((item, index) => renderSettingItem(item, index))}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        {settings.notifications && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Types
              </CardTitle>
              <CardDescription>Choose which transactions trigger alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {notificationTypes.map((item, index) => renderSettingItem(item, index))}
            </CardContent>
          </Card>
        )}

        {/* Security Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>Protect your account</CardDescription>
          </CardHeader>
          <CardContent>
            {securitySettings.map((item, index) => renderSettingItem(item, index))}
          </CardContent>
        </Card>

        {/* Support Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supportSettings.map((item, index) => renderSettingItem(item, index))}
          </CardContent>
        </Card>

        {/* Account Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserX className="h-5 w-5" />
              Account
            </CardTitle>
            <CardDescription>Manage your account</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="flex items-center justify-between py-4 cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-lg"
              onClick={() => setDeleteAccountOpen(true)}
              role="button"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-medium text-destructive">Delete Account</p>
                  <p className="text-sm text-muted-foreground">Permanently delete your account</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full h-12"
          onClick={handleSignOut}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Sign Out
        </Button>

        {/* App Version */}
        <p className="text-center text-sm text-muted-foreground pt-4">
          THE EAGLES VTU v1.0.0
        </p>
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      {/* Delete Account Dialog */}
      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
    </div>
  );
};

export default Settings;
