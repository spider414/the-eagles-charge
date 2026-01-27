import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, User, Mail, Phone, Save, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    payment_email: "",
  });

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.endsWith("@eagles.local");

  // Check if email is valid
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && !email.endsWith("@eagles.local");
  };

  useEffect(() => {
    if (profile) {
      // Get the payment email (non-synthetic email from profile)
      const profileEmail = profile.email || "";
      const paymentEmail = isValidEmail(profileEmail) ? profileEmail : "";
      
      setFormData({
        full_name: profile.full_name || "",
        phone_number: profile.phone_number || "",
        payment_email: paymentEmail,
      });
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleSave = async () => {
    // Validate payment email if provided
    if (formData.payment_email && !isValidEmail(formData.payment_email)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address for payments.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, string> = {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
      };

      // Only update email if user has synthetic email and provided a valid payment email
      if (hasSyntheticEmail() && formData.payment_email) {
        updateData.email = formData.payment_email;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
    } catch (error) {
      console.error("Profile update error:", error);
      toast({
        title: "Update Failed",
        description: "Could not update your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const initials = formData.full_name
    ? formData.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || "U";

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
            <span className="font-semibold">Profile</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              <AvatarFallback className="text-2xl font-bold gradient-hero text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground shadow-lg">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <h2 className="text-xl font-bold">{formData.full_name || "Set your name"}</h2>
          <p className="text-muted-foreground">{user.email}</p>
        </div>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Full Name
              </Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            {hasSyntheticEmail() ? (
              <div className="space-y-2">
                <Label htmlFor="payment_email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Payment Email
                </Label>
                <Input
                  id="payment_email"
                  type="email"
                  value={formData.payment_email}
                  onChange={(e) => setFormData({ ...formData, payment_email: e.target.value })}
                  placeholder="Enter email for payment receipts"
                />
                <p className="text-xs text-muted-foreground">
                  Used for card payment receipts and notifications
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  value={user.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Phone Number
              </Label>
              <Input
                id="phone"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                placeholder="Enter your phone number"
                type="tel"
              />
            </div>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-4"
            >
              {isSaving ? (
                <span className="animate-pulse">Saving...</span>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-lg">Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Referral Code</span>
              <span className="font-mono font-semibold text-primary">{profile?.referral_code || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Wallet Balance</span>
              <span className="font-semibold">₦{profile?.wallet_balance?.toLocaleString() || "0.00"}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">Referral Earnings</span>
              <span className="font-semibold text-primary">₦{profile?.total_referral_earnings?.toLocaleString() || "0.00"}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Member Since</span>
              <span className="font-semibold">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Profile;
