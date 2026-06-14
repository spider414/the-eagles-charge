import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, Phone, Lock, User, Gift, Shield, KeyRound, ArrowLeft, CheckCircle, Fingerprint, ScanFace, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { ToastAction } from "@/components/ui/toast";

const phoneSchema = z.string()
  .min(10, "Phone number must be at least 10 digits")
  .max(15, "Phone number is too long")
  .regex(/^[0-9+]+$/, "Please enter a valid phone number");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

type AuthStep = "login" | "signup-phone" | "signup-otp" | "signup-nin" | "signup-details" | "forgot-phone" | "forgot-otp" | "forgot-security" | "forgot-reset";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signUp, signIn, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { authenticateWithBiometric, isBiometricEnabled, checkBiometricSupport } = useBiometricAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [step, setStep] = useState<AuthStep>("login");
  
  // Login state
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  // Signup state
  const [signupPhone, setSignupPhone] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [ninVerified, setNinVerified] = useState(false);
  const [ninData, setNinData] = useState<{ full_name: string; nin: string; photo?: string | null } | null>(null);
  const [isVerifyingNin, setIsVerifyingNin] = useState(false);
  
  // Forgot password state
  const [forgotPhone, setForgotPhone] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotSecurityAnswer, setForgotSecurityAnswer] = useState("");
  const [forgotSecurityQuestion, setForgotSecurityQuestion] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationId, setVerificationId] = useState("");
  const [recoveryMethod, setRecoveryMethod] = useState<"otp" | "security">("otp");
  const [securityQuestionTouched, setSecurityQuestionTouched] = useState(false);
  const [securityAnswerTouched, setSecurityAnswerTouched] = useState(false);
  const [forgotSecurityAnswerTouched, setForgotSecurityAnswerTouched] = useState(false);

  useEffect(() => {
    if (user && !authLoading) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  // Check biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const supported = await checkBiometricSupport();
      const enabled = isBiometricEnabled();
      setBiometricAvailable(supported && enabled);
    };
    checkBiometric();
  }, [checkBiometricSupport, isBiometricEnabled]);

  const handleBiometricLogin = async () => {
    setIsBiometricAuthenticating(true);
    const success = await authenticateWithBiometric();
    setIsBiometricAuthenticating(false);

    if (success) {
      // Biometric verified, but we need to restore the session
      // Check if there's a stored session
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        toast({
          title: "Welcome back!",
          description: "Logged in with biometrics.",
        });
        navigate("/dashboard");
      } else {
        toast({
          title: "Session Expired",
          description: "Please log in with your password to continue.",
          variant: "destructive",
        });
      }
    }
  };

  const sendOtp = async (phone: string, purpose: "signup" | "password_reset") => {
    try {
      phoneSchema.parse(phone);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return false;
      }
    }

    setIsLoading(true);
    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.functions.invoke("send-otp", {
        body: { phone_number: phone, purpose },
      });
      data = res.data;
      error = res.error;
    } catch (networkErr) {
      setIsLoading(false);
      toast({
        title: "Network Error",
        description: "Unable to reach our servers. Check your internet connection and try again.",
        variant: "destructive",
      });
      return false;
    }
    setIsLoading(false);

    if (error || data?.error) {
      let description = data?.error || "Failed to send OTP. Please try again.";
      let status: number | undefined;
      const ctx = (error as any)?.context;
      if (ctx) {
        status = ctx.status;
        if (typeof ctx.json === "function") {
          try {
            const body = await ctx.json();
            if (body?.error) description = body.error;
          } catch {
            // ignore parse errors
          }
        }
      }

      // Already registered → offer a quick path to the login screen
      if (purpose === "signup" && /already registered/i.test(description)) {
        toast({
          title: "Phone Already Registered",
          description: "This phone number already has an account. Please log in instead.",
          variant: "destructive",
          action: (
            <ToastAction altText="Go to login" onClick={() => { resetState(); setStep("login"); }}>
              Go to Login
            </ToastAction>
          ),
        });
        return false;
      }

      if (status === 429) {
        toast({
          title: "Too Many Requests",
          description,
          variant: "destructive",
        });
        return false;
      }

      if (status && status >= 500) {
        toast({
          title: "Server Error",
          description: "Something went wrong on our end. Please try again in a moment.",
          variant: "destructive",
        });
        return false;
      }

      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "OTP Sent",
      description: "Check your phone for the verification code.",
    });
    return true;
  };

  const verifyOtp = async (phone: string, otp: string, purpose: "signup" | "password_reset") => {
    setIsLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: { phone_number: phone, otp_code: otp, purpose },
    });
    setIsLoading(false);

    if (error || data?.error) {
      toast({
        title: "Verification Failed",
        description: data?.error || "Invalid OTP. Please try again.",
        variant: "destructive",
      });
      return null;
    }

    return data.verification_id;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      phoneSchema.parse(loginPhone);
      passwordSchema.parse(loginPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    const { error } = await signIn(loginPhone, loginPassword);
    setIsLoading(false);

    if (error) {
      toast({
        title: "Login Failed",
        description: error.message === "Invalid login credentials" 
          ? "Invalid phone number or password. Please try again."
          : error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have successfully logged in.",
      });
      navigate("/dashboard");
    }
  };

  const handleSendSignupOtp = async () => {
    const success = await sendOtp(signupPhone, "signup");
    if (success) {
      setStep("signup-otp");
    }
  };

  const handleVerifySignupOtp = async () => {
    if (signupOtp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    const verificationResult = await verifyOtp(signupPhone, signupOtp, "signup");
    if (verificationResult) {
      setPhoneVerified(true);
      setStep("signup-nin");
    }
  };

  const handleVerifyNin = async () => {
    setIsVerifyingNin(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-nin-phone", {
        body: { phone_number: signupPhone },
      });

      if (error || !data?.success) {
        toast({
          title: "NIN Verification Failed",
          description: data?.error || "Could not verify NIN for this phone number. You can skip this step.",
          variant: "destructive",
        });
        setIsVerifyingNin(false);
        return;
      }

      setNinData({
        full_name: data.data.full_name,
        nin: data.data.nin,
        photo: data.data.photo,
      });
      setNinVerified(true);
      // Auto-fill the name from NIN data
      if (data.data.full_name) {
        setSignupName(data.data.full_name);
      }
      toast({
        title: "Identity Verified!",
        description: `NIN verified for ${data.data.full_name}`,
      });
    } catch (err) {
      console.error("NIN verification error:", err);
      toast({
        title: "Verification Error",
        description: "Failed to verify NIN. You can skip this step.",
        variant: "destructive",
      });
    } finally {
      setIsVerifyingNin(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneVerified) {
      toast({
        title: "Verification Required",
        description: "Please verify your phone number first.",
        variant: "destructive",
      });
      return;
    }

    try {
      passwordSchema.parse(signupPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    if (!securityQuestion || !securityAnswer) {
      toast({
        title: "Security Question Required",
        description: "Please set a security question for account recovery.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(signupPhone, signupPassword, signupName, referralCode, securityQuestion, securityAnswer, ninData);
    setIsLoading(false);

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes("already registered")) {
        errorMessage = "This phone number is already registered. Please login instead.";
      }
      toast({
        title: "Signup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Account Created!",
        description: "Welcome to THE EAGLES! You can now start making transactions.",
      });
      navigate("/dashboard");
    }
  };

  const handleForgotSendOtp = async () => {
    const success = await sendOtp(forgotPhone, "password_reset");
    if (success) {
      setStep("forgot-otp");
    }
  };

  const handleCheckSecurityQuestion = async () => {
    try {
      phoneSchema.parse(forgotPhone);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    let data: any = null;
    let error: any = null;
    try {
      const res = await supabase.functions.invoke("get-security-question", {
        body: { phone_number: forgotPhone },
      });
      data = res.data;
      error = res.error;
    } catch {
      setIsLoading(false);
      toast({
        title: "Network Error",
        description: "Unable to reach our servers. Check your internet connection and try again.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(false);

    if (error) {
      const ctx = (error as any)?.context;
      const status: number | undefined = ctx?.status;
      let description = "Unable to check account. Please try again.";
      if (ctx && typeof ctx.json === "function") {
        try {
          const body = await ctx.json();
          if (body?.error) description = body.error;
        } catch { /* ignore */ }
      }
      if (status === 429) {
        toast({ title: "Too Many Requests", description, variant: "destructive" });
      } else if (status && status >= 500) {
        toast({
          title: "Server Error",
          description: "Something went wrong on our end. Please try again in a moment.",
          variant: "destructive",
        });
      } else {
        toast({ title: "Error", description, variant: "destructive" });
      }
      return;
    }

    if (data?.has_security_question && data?.security_question) {
      setForgotSecurityQuestion(data.security_question);
      setForgotSecurityAnswer("");
      setStep("forgot-security");
    } else {
      toast({
        title: "Security Question Not Available",
        description: "No security question is set for this account. Please use OTP verification instead.",
        variant: "destructive",
      });
    }
  };

  const handleVerifyForgotOtp = async () => {
    if (forgotOtp.length !== 6) {
      toast({
        title: "Invalid OTP",
        description: "Please enter the 6-digit code.",
        variant: "destructive",
      });
      return;
    }

    const verificationResult = await verifyOtp(forgotPhone, forgotOtp, "password_reset");
    if (verificationResult) {
      setVerificationId(verificationResult);
      setStep("forgot-reset");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    try {
      passwordSchema.parse(newPassword);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: err.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    const body: Record<string, string> = {
      phone_number: forgotPhone,
      new_password: newPassword,
    };

    if (recoveryMethod === "otp") {
      body.verification_id = verificationId;
    } else {
      body.security_answer = forgotSecurityAnswer;
    }

    const { data, error } = await supabase.functions.invoke("reset-password", {
      body,
    });
    setIsLoading(false);

    if (error || data?.error) {
      toast({
        title: "Reset Failed",
        description: data?.error || "Failed to reset password. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Password Reset!",
      description: "Your password has been reset. Please login with your new password.",
    });
    setStep("login");
    resetState();
  };

  const handleSecurityReset = async () => {
    const trimmed = forgotSecurityAnswer.trim();
    if (!trimmed) {
      toast({
        title: "Answer Required",
        description: "Please enter your security answer.",
        variant: "destructive",
      });
      return;
    }
    if (trimmed.length < 2) {
      toast({
        title: "Answer Too Short",
        description: "Your answer must be at least 2 characters.",
        variant: "destructive",
      });
      return;
    }
    setRecoveryMethod("security");
    setStep("forgot-reset");
  };

  const resetState = () => {
    setSignupPhone("");
    setSignupOtp("");
    setSignupPassword("");
    setSignupName("");
    setReferralCode("");
    setSecurityQuestion("");
    setSecurityAnswer("");
    setPhoneVerified(false);
    setNinVerified(false);
    setNinData(null);
    setIsVerifyingNin(false);
    setForgotPhone("");
    setForgotOtp("");
    setForgotSecurityAnswer("");
    setForgotSecurityQuestion("");
    setNewPassword("");
    setConfirmPassword("");
    setVerificationId("");
    setRecoveryMethod("otp");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse-soft text-primary">Loading...</div>
      </div>
    );
  }

  const renderBackButton = (targetStep: AuthStep) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        setStep(targetStep);
        if (targetStep === "login") resetState();
      }}
      className="mb-4"
    >
      <ArrowLeft className="h-4 w-4 mr-2" />
      Back
    </Button>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-gold shadow-gold">
            <Bird className="h-7 w-7 text-secondary-foreground" />
          </div>
          <span className="text-2xl font-bold text-foreground">
            THE <span className="text-gradient-gold">EAGLES</span>
          </span>
        </div>

        <Card className="shadow-elevated border-2 border-border">
          {step === "login" && (
            <Tabs defaultValue="login" className="w-full">
              <CardHeader className="pb-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Login</TabsTrigger>
                  <TabsTrigger value="signup" onClick={() => setStep("signup-phone")}>Sign Up</TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent>
                <TabsContent value="login" className="mt-0">
                  <CardTitle className="text-xl mb-2">Welcome Back</CardTitle>
                  <CardDescription className="mb-6">
                    Enter your credentials to access your account
                  </CardDescription>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-phone"
                          type="tel"
                          placeholder="08012345678"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type="password"
                          placeholder="••••••••"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="pl-10"
                          required
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading ? "Logging in..." : "Login"}
                    </Button>

                    {/* Biometric Login Button */}
                    {biometricAvailable && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={handleBiometricLogin}
                        disabled={isBiometricAuthenticating}
                      >
                        <Fingerprint className="h-4 w-4 mr-2" />
                        {isBiometricAuthenticating ? "Authenticating..." : "Login with Biometrics"}
                      </Button>
                    )}
                    
                    <Button
                      type="button"
                      variant="link"
                      className="w-full"
                      onClick={() => setStep("forgot-phone")}
                    >
                      Forgot Password?
                    </Button>
                  </form>
                </TabsContent>
              </CardContent>
            </Tabs>
          )}

          {/* Biometric Quick Access - shown when biometric is enabled but not logged in */}
          {biometricAvailable && step === "login" && (
            <div className="absolute -bottom-16 left-0 right-0 flex justify-center">
              <Button
                variant="ghost"
                size="lg"
                className="rounded-full h-14 w-14 bg-primary/10 hover:bg-primary/20"
                onClick={handleBiometricLogin}
                disabled={isBiometricAuthenticating}
              >
                <Fingerprint className="h-7 w-7 text-primary" />
              </Button>
            </div>
          )}

          {/* Signup - Phone Entry */}
          {step === "signup-phone" && (
            <CardContent className="pt-6">
              {renderBackButton("login")}
              <CardTitle className="text-xl mb-2">Create Account</CardTitle>
              <CardDescription className="mb-6">
                Enter your phone number to get started
              </CardDescription>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-phone"
                      type="tel"
                      placeholder="08012345678"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button onClick={handleSendSignupOtp} className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending OTP..." : "Send Verification Code"}
                </Button>
              </div>
            </CardContent>
          )}

          {/* Signup - OTP Verification */}
          {step === "signup-otp" && (
            <CardContent className="pt-6">
              {renderBackButton("signup-phone")}
              <CardTitle className="text-xl mb-2">Verify Phone Number</CardTitle>
              <CardDescription className="mb-6">
                Enter the 6-digit code sent to {signupPhone}
              </CardDescription>
              
              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={signupOtp} onChange={setSignupOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button onClick={handleVerifySignupOtp} className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
                
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => sendOtp(signupPhone, "signup")}
                  disabled={isLoading}
                >
                  Resend Code
                </Button>
              </div>
            </CardContent>
          )}

          {/* Signup - NIN Verification */}
          {step === "signup-nin" && (
            <CardContent className="pt-6">
              {renderBackButton("signup-phone")}
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-sm text-primary">Phone verified: {signupPhone}</span>
              </div>
              <CardTitle className="text-xl mb-2">Identity Verification</CardTitle>
              <CardDescription className="mb-6">
                Verify your identity using NIN linked to your phone number
              </CardDescription>
              
              <div className="space-y-4">
                {!ninVerified ? (
                  <>
                    <div className="p-4 bg-muted rounded-lg text-center space-y-2">
                      <ScanFace className="h-12 w-12 mx-auto text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        We'll look up your NIN using your registered phone number <strong>{signupPhone}</strong>
                      </p>
                    </div>

                    <Button 
                      onClick={handleVerifyNin} 
                      className="w-full" 
                      disabled={isVerifyingNin}
                    >
                      {isVerifyingNin ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Verifying Identity...
                        </>
                      ) : (
                        <>
                          <ScanFace className="h-4 w-4 mr-2" />
                          Verify My NIN
                        </>
                      )}
                    </Button>

                    <Button 
                      variant="ghost" 
                      className="w-full text-muted-foreground" 
                      onClick={() => setStep("signup-details")}
                    >
                      Skip for now
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="p-4 bg-muted rounded-lg space-y-3">
                      <div className="flex items-center gap-3">
                        {ninData?.photo && (
                          <img 
                            src={`data:image/jpeg;base64,${ninData.photo}`} 
                            alt="NIN Photo" 
                            className="h-16 w-16 rounded-full object-cover border-2 border-primary"
                          />
                        )}
                        <div>
                          <p className="font-semibold text-foreground">{ninData?.full_name}</p>
                          <p className="text-xs text-muted-foreground">NIN: {ninData?.nin?.substring(0, 4)}****{ninData?.nin?.slice(-3)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span className="text-sm text-primary font-medium">Identity Verified</span>
                      </div>
                    </div>

                    <Button 
                      onClick={() => setStep("signup-details")} 
                      className="w-full"
                    >
                      Continue to Profile Setup
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          )}

          {/* Signup - Details */}
          {step === "signup-details" && (
            <CardContent className="pt-6">
              {renderBackButton("signup-nin")}
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                <span className="text-sm text-primary">Phone verified: {signupPhone}</span>
              </div>
              {ninVerified && (
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm text-primary">NIN verified: {ninData?.full_name}</span>
                </div>
              )}
              <CardTitle className="text-xl mb-2">Complete Your Profile</CardTitle>
              <CardDescription className="mb-6">
                Fill in your details to create your account
              </CardDescription>
              
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="security-question">Security Question (for account recovery)</Label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="security-question"
                      type="text"
                      placeholder="e.g., What is your mother's maiden name?"
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      onBlur={() => setSecurityQuestionTouched(true)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {securityQuestionTouched && !securityQuestion.trim() && (
                    <p className="text-sm text-destructive">Security question is required</p>
                  )}
                  {securityQuestionTouched && securityQuestion.trim() && securityQuestion.trim().length < 5 && (
                    <p className="text-sm text-destructive">Question must be at least 5 characters</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="security-answer">Security Answer</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="security-answer"
                      type="text"
                      placeholder="Your answer"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      onBlur={() => setSecurityAnswerTouched(true)}
                      className="pl-10"
                      required
                    />
                  </div>
                  {securityAnswerTouched && !securityAnswer.trim() && (
                    <p className="text-sm text-destructive">Security answer is required</p>
                  )}
                  {securityAnswerTouched && securityAnswer.trim() && securityAnswer.trim().length < 2 && (
                    <p className="text-sm text-destructive">Answer must be at least 2 characters</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referral-code">Referral Code (Optional)</Label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="referral-code"
                      type="text"
                      placeholder="EAGLE123ABC"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    isLoading ||
                    !securityQuestion.trim() ||
                    securityQuestion.trim().length < 5 ||
                    !securityAnswer.trim() ||
                    securityAnswer.trim().length < 2
                  }
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>
            </CardContent>
          )}

          {/* Forgot Password - Phone Entry */}
          {step === "forgot-phone" && (
            <CardContent className="pt-6">
              {renderBackButton("login")}
              <CardTitle className="text-xl mb-2">Reset Password</CardTitle>
              <CardDescription className="mb-6">
                Enter your phone number to recover your account
              </CardDescription>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-phone"
                      type="tel"
                      placeholder="08012345678"
                      value={forgotPhone}
                      onChange={(e) => setForgotPhone(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button onClick={handleForgotSendOtp} className="w-full" disabled={isLoading}>
                  {isLoading ? "Sending OTP..." : "Send OTP to Phone"}
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or if you lost your phone
                    </span>
                  </div>
                </div>
                
                <Button 
                  variant="outline" 
                  onClick={handleCheckSecurityQuestion} 
                  className="w-full" 
                  disabled={isLoading || !forgotPhone.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking account...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Use Security Question
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          )}

          {/* Forgot Password - OTP Verification */}
          {step === "forgot-otp" && (
            <CardContent className="pt-6">
              {renderBackButton("forgot-phone")}
              <CardTitle className="text-xl mb-2">Verify Your Phone</CardTitle>
              <CardDescription className="mb-6">
                Enter the 6-digit code sent to {forgotPhone}
              </CardDescription>
              
              <div className="space-y-4">
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={forgotOtp} onChange={setForgotOtp}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button onClick={handleVerifyForgotOtp} className="w-full" disabled={isLoading}>
                  {isLoading ? "Verifying..." : "Verify Code"}
                </Button>
                
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => sendOtp(forgotPhone, "password_reset")}
                  disabled={isLoading}
                >
                  Resend Code
                </Button>
              </div>
            </CardContent>
          )}

          {/* Forgot Password - Security Question */}
          {step === "forgot-security" && (
            <CardContent className="pt-6">
              {renderBackButton("forgot-phone")}
              <CardTitle className="text-xl mb-2">Answer Security Question</CardTitle>
              <CardDescription className="mb-6">
                Please answer your security question
              </CardDescription>
              
              <div className="space-y-4">
                {forgotSecurityQuestion ? (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium">{forgotSecurityQuestion}</p>
                  </div>
                ) : (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg">
                    <p className="text-sm text-destructive font-medium">No security question found for this account.</p>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="security-answer-input">Your Answer</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="security-answer-input"
                      type="text"
                      placeholder="Enter your answer"
                      value={forgotSecurityAnswer}
                      onChange={(e) => setForgotSecurityAnswer(e.target.value)}
                      onBlur={() => setForgotSecurityAnswerTouched(true)}
                      className="pl-10"
                    />
                  </div>
                  {forgotSecurityAnswerTouched && !forgotSecurityAnswer.trim() && (
                    <p className="text-sm text-destructive">Answer is required</p>
                  )}
                  {forgotSecurityAnswerTouched && forgotSecurityAnswer.trim() && forgotSecurityAnswer.trim().length < 2 && (
                    <p className="text-sm text-destructive">Answer must be at least 2 characters</p>
                  )}
                </div>

                <Button
                  onClick={handleSecurityReset}
                  className="w-full"
                  disabled={isLoading || !forgotSecurityQuestion || forgotSecurityAnswer.trim().length < 2}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  disabled={isLoading}
                  onClick={() => {
                    setForgotSecurityAnswer("");
                    setForgotSecurityAnswerTouched(false);
                    setStep("forgot-phone");
                  }}
                >
                  Use OTP Instead
                </Button>
              </div>
            </CardContent>
          )}

          {/* Forgot Password - New Password */}
          {step === "forgot-reset" && (
            <CardContent className="pt-6">
              {renderBackButton("forgot-phone")}
              <CardTitle className="text-xl mb-2">Set New Password</CardTitle>
              <CardDescription className="mb-6">
                Create a new password for your account
              </CardDescription>
              
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            </CardContent>
          )}
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <a href="/" className="hover:text-primary transition-colors">
            ← Back to Home
          </a>
        </p>
      </div>
    </div>
  );
};

export default Auth;
