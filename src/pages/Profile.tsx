import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, User, Mail, Phone, Save, Camera, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { isValidEmail, getEmailSuggestion } from "@/utils/emailUtils";
import BrandLogo from "@/components/BrandLogo";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [emailLocked, setEmailLocked] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: "",
    phone_number: "",
    payment_email: "",
  });

  // Check if user has a synthetic phone-based email
  const hasSyntheticEmail = () => user?.email?.match(/@(eagles\.local|phone\.harmicglobal\.com)$/);

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
      
      // Check if email is already locked
      fetchEmailLockStatus();
      
      // Fetch avatar URL
      fetchAvatarUrl();
    }
  }, [profile, user]);

  const fetchEmailLockStatus = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("payment_email_locked, email")
      .eq("user_id", user.id)
      .single();
    
    if (data) {
      // Email is locked if payment_email_locked is true AND email is valid
      const hasValidPaymentEmail = isValidEmail(data.email || "");
      setEmailLocked(data.payment_email_locked === true && hasValidPaymentEmail);
    }
  };

  const fetchAvatarUrl = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url")
      .eq("user_id", user.id)
      .single();
    
    if (data?.avatar_url) {
      const signed = await resolveAvatarUrl(data.avatar_url);
      if (signed) setAvatarUrl(signed);
    }
  };

  // The avatars bucket is private, so we always display via a signed URL.
  const resolveAvatarUrl = async (stored: string): Promise<string | null> => {
    // Support legacy values that were saved as full public URLs
    let path = stored;
    const marker = "/object/public/avatars/";
    if (stored.includes(marker)) {
      path = stored.split(marker)[1].split("?")[0];
    }
    if (path.startsWith("http")) return stored;

    const { data, error } = await supabase.storage
      .from("avatars")
      .createSignedUrl(decodeURIComponent(path), 60 * 60 * 24 * 365);
    if (error) {
      console.error("Avatar signed URL error:", error);
      return null;
    }
    return data?.signedUrl ?? null;
  };

  const handlePaymentEmailChange = (email: string) => {
    setFormData({ ...formData, payment_email: email });
    
    // Check for email suggestions
    const suggestion = getEmailSuggestion(email);
    setEmailSuggestion(suggestion);
  };

  const applySuggestion = () => {
    if (emailSuggestion) {
      setFormData({ ...formData, payment_email: emailSuggestion });
      setEmailSuggestion(null);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid File",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Create a unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the storage path; the bucket is private so we display signed URLs
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: fileName })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      const signed = await resolveAvatarUrl(fileName);
      setAvatarUrl(signed ? `${signed}${signed.includes("?") ? "&" : "?"}t=${Date.now()}` : "");
      toast({
        title: "Photo Updated",
        description: "Your profile photo has been updated.",
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast({
        title: "Upload Failed",
        description: "Could not upload your photo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

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
    // Validate payment email if provided and not already locked
    if (formData.payment_email && !emailLocked) {
      if (!isValidEmail(formData.payment_email)) {
        toast({
          title: "Invalid Email",
          description: "Please enter a valid email address for payments.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSaving(true);
    try {
      const updateData: {
        full_name: string;
        phone_number: string;
        email?: string;
        payment_email_locked?: boolean;
      } = {
        full_name: formData.full_name,
        phone_number: formData.phone_number,
      };

      // Only update email if user has synthetic email, provided a valid payment email, and it's not locked
      if (hasSyntheticEmail() && formData.payment_email && !emailLocked) {
        updateData.email = formData.payment_email;
        updateData.payment_email_locked = true; // Lock the email after first save
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) throw error;

      // If we just saved a payment email, lock it locally
      if (updateData.payment_email_locked) {
        setEmailLocked(true);
      }

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

  // Display the real identifier (phone or valid email)
  const getDisplayIdentifier = () => {
    // If user has a real email (not synthetic), show it
    if (!hasSyntheticEmail() && user.email) {
      return user.email;
    }
    // Otherwise show phone number
    if (profile?.phone_number) {
      return profile.phone_number;
    }
    // Fallback to payment email if locked
    if (emailLocked && formData.payment_email) {
      return formData.payment_email;
    }
    return "Add your details";
  };

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
            <span className="font-semibold">Profile</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto">
        {/* Avatar Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <Avatar className="h-24 w-24 border-4 border-primary/20">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt="Profile photo" />
              ) : null}
              <AvatarFallback className="text-2xl font-bold gradient-hero text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleAvatarUpload}
              accept="image/*"
              className="hidden"
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute bottom-0 right-0 p-2 bg-primary rounded-full text-primary-foreground shadow-lg disabled:opacity-50"
            >
              {isUploading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
          </div>
          <h2 className="text-xl font-bold">{formData.full_name || "Set your name"}</h2>
          <p className="text-muted-foreground">{getDisplayIdentifier()}</p>
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
                  {emailLocked ? (
                    <Lock className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  )}
                  Payment Email
                  {emailLocked && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  )}
                </Label>
                <Input
                  id="payment_email"
                  type="email"
                  value={formData.payment_email}
                  onChange={(e) => handlePaymentEmailChange(e.target.value)}
                  placeholder={emailLocked ? "" : "Enter email for payment receipts"}
                  disabled={emailLocked}
                  className={emailLocked ? "bg-muted" : ""}
                />
                {emailSuggestion && !emailLocked && (
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="text-xs text-primary hover:underline"
                  >
                    Did you mean {emailSuggestion}?
                  </button>
                )}
                <p className="text-xs text-muted-foreground">
                  {emailLocked 
                    ? "Email is locked and cannot be changed" 
                    : "Used for card payment receipts. This will be locked after saving."
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
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
