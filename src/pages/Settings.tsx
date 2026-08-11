import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, Sun, Bell, Shield, HelpCircle, FileText, LogOut, ChevronRight, Smartphone, Fingerprint, Vibrate, Volume2, Zap, Wallet, Phone, Wifi, Receipt, Trash2, UserX, KeyRound, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { usePinAuth } from "@/hooks/usePinAuth";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import DeleteAccountDialog from "@/components/DeleteAccountDialog";
import { PinSetupDialog } from "@/components/PinSetupDialog";
import EmailPreferences from "@/components/EmailPreferences";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import BrandLogo from "@/components/BrandLogo";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LanguageCode } from "@/i18n/translations";

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
  const { isPinEnabled, disablePin } = usePinAuth();
  const { testSound, playToggle } = useSoundEffects();
  const { t, language, setLanguage, languages } = useLanguage();

  const handleLanguageChange = (value: string) => {
    setLanguage(value as LanguageCode);
    toast({
      title: t("settings.languageUpdated"),
      description: t("settings.languageUpdatedDesc"),
    });
  };
  
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinDialogMode, setPinDialogMode] = useState<"setup" | "change" | "disable">("setup");
  const [autoLockTimeout, setAutoLockTimeout] = useState(() => {
    const stored = localStorage.getItem("autoLockTimeout");
    return stored || "10"; // Default 10 minutes
  });

  // Settings state (stored in localStorage for persistence)
  const [settings, setSettings] = useState(() => ({
    darkMode: localStorage.getItem("theme") === "dark",
    notifications: localStorage.getItem("notifications") !== "false",
    biometric: isBiometricEnabled(),
    pinLock: isPinEnabled(),
    sessionLock: localStorage.getItem("sessionLockEnabled") === "true",
    hapticFeedback: localStorage.getItem("hapticFeedback") !== "false",
    soundEffects: localStorage.getItem("soundEffects") !== "false",
  }));

  const handleAutoLockTimeoutChange = (value: string) => {
    setAutoLockTimeout(value);
    localStorage.setItem("autoLockTimeout", value);
    
    if (settings.hapticFeedback) {
      triggerHaptic();
    }
    if (settings.soundEffects) {
      playToggle();
    }
    
    toast({
      title: "Auto-Lock Updated",
      description: `Session will lock after ${value} minute${value === "1" ? "" : "s"} of inactivity.`,
    });
  };

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
      new Notification("HARMIC RECHARGE", {
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

    // Special handling for PIN lock
    if (key === "pinLock") {
      if (value) {
        // Open PIN setup dialog
        setPinDialogMode("setup");
        setPinDialogOpen(true);
        return; // Don't update state yet, wait for dialog completion
      } else {
        // Open PIN disable dialog
        setPinDialogMode("disable");
        setPinDialogOpen(true);
        return;
      }
    }

    // Special handling for session lock
    if (key === "sessionLock") {
      // Check if user has biometric or PIN set up before enabling
      if (value && !settings.biometric && !settings.pinLock) {
        toast({
          title: "Security Required",
          description: "Please set up PIN or Biometric authentication first.",
          variant: "destructive",
        });
        return;
      }
      setSettings((prev) => ({ ...prev, sessionLock: value }));
      localStorage.setItem("sessionLockEnabled", value.toString());
      
      if (settings.hapticFeedback) {
        triggerHaptic();
      }
      if (settings.soundEffects) {
        playToggle();
      }
      
      toast({
        title: "Session Lock Updated",
        description: value 
          ? "App will lock after inactivity." 
          : "Session lock has been disabled.",
      });
      return;
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
      label: t("settings.darkMode"),
      description: t("settings.darkModeDesc"),
      type: "toggle",
      value: settings.darkMode,
      onChange: (value) => updateSetting("darkMode", value),
    },
    {
      icon: Bell,
      label: t("settings.push"),
      description: t("settings.pushDesc"),
      type: "toggle",
      value: settings.notifications,
      onChange: (value) => updateSetting("notifications", value),
    },
    {
      icon: Volume2,
      label: t("settings.sound"),
      description: t("settings.soundDesc"),
      type: "toggle",
      value: settings.soundEffects,
      onChange: (value) => updateSetting("soundEffects", value),
    },
    {
      icon: Vibrate,
      label: t("settings.haptic"),
      description: t("settings.hapticDesc"),
      type: "toggle",
      value: settings.hapticFeedback,
      onChange: (value) => updateSetting("hapticFeedback", value),
    },
  ];

  const notificationTypes: SettingItem[] = [
    {
      icon: Phone,
      label: t("service.airtime"),
      description: t("settings.airtimeAlerts"),
      type: "toggle",
      value: notificationPrefs.airtime,
      onChange: (value) => updateNotificationPref("airtime", value),
      disabled: !settings.notifications,
    },
    {
      icon: Wifi,
      label: t("service.data"),
      description: t("settings.dataAlerts"),
      type: "toggle",
      value: notificationPrefs.data,
      onChange: (value) => updateNotificationPref("data", value),
      disabled: !settings.notifications,
    },
    {
      icon: Receipt,
      label: t("settings.bills"),
      description: t("settings.billsAlerts"),
      type: "toggle",
      value: notificationPrefs.bills,
      onChange: (value) => updateNotificationPref("bills", value),
      disabled: !settings.notifications,
    },
    {
      icon: Wallet,
      label: t("settings.wallet"),
      description: t("settings.walletAlerts"),
      type: "toggle",
      value: notificationPrefs.wallet,
      onChange: (value) => updateNotificationPref("wallet", value),
      disabled: !settings.notifications,
    },
  ];

  // Refresh PIN state after dialog closes
  const handlePinDialogSuccess = () => {
    setSettings((prev) => ({ ...prev, pinLock: isPinEnabled() }));
  };

  const securitySettings: SettingItem[] = [
    {
      icon: Fingerprint,
      label: t("settings.biometric"),
      description: biometricSupported 
        ? t("settings.biometricYes")
        : t("settings.biometricNo"),
      type: "toggle",
      value: settings.biometric,
      onChange: (value) => updateSetting("biometric", value),
      disabled: !biometricSupported,
    },
    {
      icon: KeyRound,
      label: t("settings.pinLock"),
      description: settings.pinLock 
        ? t("settings.pinOn")
        : t("settings.pinOff"),
      type: settings.pinLock ? "link" : "toggle",
      value: settings.pinLock,
      onChange: (value) => updateSetting("pinLock", value),
      onClick: settings.pinLock ? () => {
        setPinDialogMode("change");
        setPinDialogOpen(true);
      } : undefined,
    },
    {
      icon: Lock,
      label: t("settings.sessionLock"),
      description: settings.sessionLock 
        ? t("settings.sessionLockOn")
        : t("settings.sessionLockOff"),
      type: "toggle",
      value: settings.sessionLock,
      onChange: (value) => updateSetting("sessionLock", value),
      disabled: !settings.biometric && !settings.pinLock,
    },
    {
      icon: Shield,
      label: t("settings.changePassword"),
      description: t("settings.changePasswordDesc"),
      type: "link",
      onClick: () => setChangePasswordOpen(true),
    },
  ];

  const supportSettings: SettingItem[] = [
    {
      icon: HelpCircle,
      label: t("settings.help"),
      description: t("settings.helpDesc"),
      type: "link",
      onClick: () => navigate("/support"),
    },
    {
      icon: FileText,
      label: t("settings.terms"),
      description: t("settings.termsDesc"),
      type: "link",
      onClick: () => navigate("/terms"),
    },
    {
      icon: FileText,
      label: t("settings.privacy"),
      description: t("settings.privacyDesc"),
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
            <BrandLogo className="h-8 w-8" rounded="rounded-lg" />
            <span className="font-semibold">{t("settings.title")}</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-4">
        {/* App Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              {t("settings.app")}
            </CardTitle>
            <CardDescription>{t("settings.appDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Language selector */}
            <div className="flex items-center justify-between py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Languages className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{t("settings.language")}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.languageDesc")}</p>
                </div>
              </div>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                      {lang.native}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {appSettings.map((item, index) => renderSettingItem(item, index))}
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        {settings.notifications && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
              {t("settings.notificationTypes")}
              </CardTitle>
            <CardDescription>{t("settings.notificationTypesDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <PushNotificationToggle />
              <div className="border-t border-border mt-2 pt-2">
                {notificationTypes.map((item, index) => renderSettingItem(item, index))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Security Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("settings.security")}
            </CardTitle>
            <CardDescription>{t("settings.securityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {securitySettings.map((item, index) => renderSettingItem(item, index))}
            
            {/* Auto-lock timeout setting - only show if biometric or PIN is enabled */}
            {(settings.biometric || settings.pinLock) && (
              <div className="flex items-center justify-between py-4 border-t border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">{t("settings.autoLock")}</p>
                    <p className="text-sm text-muted-foreground">{t("settings.autoLockDesc")}</p>
                  </div>
                </div>
                <Select value={autoLockTimeout} onValueChange={handleAutoLockTimeoutChange}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 min</SelectItem>
                    <SelectItem value="2">2 min</SelectItem>
                    <SelectItem value="5">5 min</SelectItem>
                    <SelectItem value="10">10 min</SelectItem>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Support Settings */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              {t("settings.support")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {supportSettings.map((item, index) => renderSettingItem(item, index))}
          </CardContent>
        </Card>

        {/* Email Preferences */}
        <EmailPreferences />

        {/* Account Section */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UserX className="h-5 w-5" />
              {t("settings.account")}
            </CardTitle>
            <CardDescription>{t("settings.accountDesc")}</CardDescription>
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
                  <p className="font-medium text-destructive">{t("settings.deleteAccount")}</p>
                  <p className="text-sm text-muted-foreground">{t("settings.deleteAccountDesc")}</p>
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
          {t("common.signOut")}
        </Button>

        {/* App Version */}
        <p className="text-center text-sm text-muted-foreground pt-4">
          HARMIC RECHARGE v1.0.0
        </p>
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen} />

      {/* Delete Account Dialog */}
      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />

      {/* PIN Setup Dialog */}
      <PinSetupDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        mode={pinDialogMode}
        onSuccess={handlePinDialogSuccess}
      />
    </div>
  );
};

export default Settings;
