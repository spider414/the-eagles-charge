import { useState } from "react";
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
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";


interface SettingItem {
  icon: React.ElementType;
  label: string;
  description?: string;
  type: "toggle" | "link" | "action";
  value?: boolean;
  onClick?: () => void;
  onChange?: (value: boolean) => void;
}

const Settings = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { toast } = useToast();

  // Settings state (stored in localStorage for persistence)
  const [settings, setSettings] = useState(() => ({
    darkMode: localStorage.getItem("theme") === "dark",
    notifications: localStorage.getItem("notifications") !== "false",
    biometric: localStorage.getItem("biometric") === "true",
    hapticFeedback: localStorage.getItem("hapticFeedback") !== "false",
  }));

  const updateSetting = (key: keyof typeof settings, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    localStorage.setItem(key, value.toString());

    if (key === "darkMode") {
      document.documentElement.classList.toggle("dark", value);
      localStorage.setItem("theme", value ? "dark" : "light");
    }

    toast({
      title: "Setting Updated",
      description: `${key.replace(/([A-Z])/g, " $1").trim()} has been ${value ? "enabled" : "disabled"}.`,
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
      icon: Vibrate,
      label: "Haptic Feedback",
      description: "Vibration on button press",
      type: "toggle",
      value: settings.hapticFeedback,
      onChange: (value) => updateSetting("hapticFeedback", value),
    },
  ];

  const securitySettings: SettingItem[] = [
    {
      icon: Fingerprint,
      label: "Biometric Login",
      description: "Use fingerprint or face ID",
      type: "toggle",
      value: settings.biometric,
      onChange: (value) => updateSetting("biometric", value),
    },
    {
      icon: Shield,
      label: "Change Password",
      description: "Update your account password",
      type: "link",
      onClick: () => {
        toast({
          title: "Password Reset",
          description: "A password reset link will be sent to your email.",
        });
      },
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
      className="flex items-center justify-between py-4 border-b border-border last:border-0"
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
        <Switch checked={item.value} onCheckedChange={item.onChange} />
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
    </div>
  );
};

export default Settings;
