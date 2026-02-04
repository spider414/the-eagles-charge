import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft, Building2, Briefcase, FileText, Users, Check, Info, Phone, Mail, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";

type RegistrationType = "business_name" | "limited_company" | "incorporated_trustee";

interface RegistrationOption {
  id: RegistrationType;
  title: string;
  description: string;
  price: number;
  duration: string;
  icon: typeof Building2;
  features: string[];
}

const registrationOptions: RegistrationOption[] = [
  {
    id: "business_name",
    title: "Business Name",
    description: "Register a sole proprietorship or partnership",
    price: 15000,
    duration: "3-5 working days",
    icon: Briefcase,
    features: [
      "CAC Certificate",
      "Status Report",
      "Certified True Copy (CTC)",
      "Valid for life"
    ]
  },
  {
    id: "limited_company",
    title: "Limited Company",
    description: "Register a private limited liability company",
    price: 75000,
    duration: "7-14 working days",
    icon: Building2,
    features: [
      "CAC Certificate",
      "Memorandum & Articles",
      "Status Report",
      "Share Allotment",
      "Board Resolution Templates"
    ]
  },
  {
    id: "incorporated_trustee",
    title: "Incorporated Trustee (NGO)",
    description: "Register NGOs, churches, and associations",
    price: 50000,
    duration: "14-21 working days",
    icon: Users,
    features: [
      "CAC Certificate",
      "Constitution Template",
      "Trustee Details",
      "Status Report"
    ]
  }
];

const BusinessRegistration = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState<RegistrationType | null>(null);
  const [step, setStep] = useState<"select" | "form">("select");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    proposedName1: "",
    proposedName2: "",
    proposedName3: "",
    businessAddress: "",
    businessObjectives: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  });

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        contactName: profile.full_name || "",
        contactEmail: profile.email || "",
        contactPhone: profile.phone_number || "",
      }));
    }
  }, [profile]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  const selectedOption = registrationOptions.find(opt => opt.id === selectedType);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.proposedName1 || !formData.businessAddress || !formData.contactName || !formData.contactEmail || !formData.contactPhone) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    // Simulate submission - in production, this would call an API
    await new Promise(resolve => setTimeout(resolve, 2000));

    toast({
      title: "Application Submitted!",
      description: "Our team will contact you within 24 hours to proceed with your registration.",
    });

    setIsSubmitting(false);
    navigate("/dashboard");
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl">
          <div className="container flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => step === "form" ? setStep("select") : navigate("/dashboard")}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-gold shadow-gold">
                  <Bird className="h-6 w-6 text-secondary-foreground" />
                </div>
                <span className="text-xl font-bold text-foreground">
                  CAC <span className="text-gradient-gold">Registration</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="container py-8 max-w-2xl">
          {step === "select" ? (
            <>
              {/* Hero Section */}
              <div className="text-center mb-8 animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-4 rounded-2xl gradient-hero flex items-center justify-center">
                  <Building2 className="h-10 w-10 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Company & Business Registration</h1>
                <p className="text-muted-foreground">
                  Register your business with the Corporate Affairs Commission (CAC)
                </p>
              </div>

              {/* Info Banner */}
              <Card className="mb-6 border-primary/20 bg-primary/5 animate-fade-in">
                <CardContent className="p-4">
                  <div className="flex gap-3">
                    <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-foreground mb-1">What you'll need:</p>
                      <ul className="text-muted-foreground space-y-1">
                        <li>• Valid means of identification (NIN, Driver's License, or Passport)</li>
                        <li>• Proposed business name(s)</li>
                        <li>• Business address</li>
                        <li>• Nature of business activities</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Registration Options */}
              <div className="space-y-4">
                {registrationOptions.map((option, index) => (
                  <Card 
                    key={option.id}
                    className={`cursor-pointer transition-all animate-fade-in hover:shadow-card ${
                      selectedType === option.id 
                        ? "border-primary ring-2 ring-primary/20" 
                        : "border-border hover:border-primary/50"
                    }`}
                    style={{ animationDelay: `${index * 100}ms` }}
                    onClick={() => setSelectedType(option.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center shrink-0">
                          <option.icon className="h-6 w-6 text-primary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{option.title}</h3>
                              <p className="text-sm text-muted-foreground">{option.description}</p>
                            </div>
                            {selectedType === option.id && (
                              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                                <Check className="h-4 w-4 text-primary-foreground" />
                              </div>
                            )}
                          </div>
                          
                          <div className="mt-3 flex items-center gap-4">
                            <span className="text-lg font-bold text-primary">
                              ₦{option.price.toLocaleString()}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                              {option.duration}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {option.features.map((feature) => (
                              <span 
                                key={feature}
                                className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded-md"
                              >
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Continue Button */}
              <div className="mt-6 animate-fade-in" style={{ animationDelay: "300ms" }}>
                <Button 
                  size="lg" 
                  className="w-full" 
                  disabled={!selectedType}
                  onClick={() => setStep("form")}
                >
                  {selectedType 
                    ? `Continue with ${selectedOption?.title}` 
                    : "Select a Registration Type"
                  }
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Form Step */}
              <Card className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg gradient-hero flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{selectedOption?.title} Registration</CardTitle>
                      <CardDescription>
                        ₦{selectedOption?.price.toLocaleString()} • {selectedOption?.duration}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Proposed Names */}
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Proposed Business Names</Label>
                      <p className="text-sm text-muted-foreground -mt-2">
                        Provide up to 3 names in order of preference. CAC will approve the first available name.
                      </p>
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="name1" className="text-sm">First Choice (Required)</Label>
                          <Input
                            id="name1"
                            placeholder="e.g., Eagles Tech Solutions"
                            value={formData.proposedName1}
                            onChange={(e) => setFormData({ ...formData, proposedName1: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name2" className="text-sm">Second Choice (Optional)</Label>
                          <Input
                            id="name2"
                            placeholder="Alternative name"
                            value={formData.proposedName2}
                            onChange={(e) => setFormData({ ...formData, proposedName2: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="name3" className="text-sm">Third Choice (Optional)</Label>
                          <Input
                            id="name3"
                            placeholder="Another alternative"
                            value={formData.proposedName3}
                            onChange={(e) => setFormData({ ...formData, proposedName3: e.target.value })}
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Business Address */}
                    <div className="space-y-2">
                      <Label htmlFor="address">Business Address</Label>
                      <Textarea
                        id="address"
                        placeholder="Enter your full business address"
                        value={formData.businessAddress}
                        onChange={(e) => setFormData({ ...formData, businessAddress: e.target.value })}
                        rows={3}
                      />
                    </div>

                    {/* Business Objectives */}
                    <div className="space-y-2">
                      <Label htmlFor="objectives">Nature of Business / Objectives</Label>
                      <Textarea
                        id="objectives"
                        placeholder="Describe your business activities (e.g., General merchandise, IT consulting, etc.)"
                        value={formData.businessObjectives}
                        onChange={(e) => setFormData({ ...formData, businessObjectives: e.target.value })}
                        rows={3}
                      />
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                      <Label className="text-base font-medium">Contact Information</Label>
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="contactName" className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            Full Name
                          </Label>
                          <Input
                            id="contactName"
                            placeholder="Your full name"
                            value={formData.contactName}
                            onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactEmail" className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            Email Address
                          </Label>
                          <Input
                            id="contactEmail"
                            type="email"
                            placeholder="your@email.com"
                            value={formData.contactEmail}
                            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                            className="h-11"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contactPhone" className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            Phone Number
                          </Label>
                          <Input
                            id="contactPhone"
                            type="tel"
                            placeholder="08012345678"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                            className="h-11"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? "Submitting..." : `Submit Application - ₦${selectedOption?.price.toLocaleString()}`}
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                      Our team will review your application and contact you within 24 hours with next steps.
                    </p>
                  </form>
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </PageTransition>
  );
};

export default BusinessRegistration;