import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Privacy = () => {
  const navigate = useNavigate();

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
            <span className="font-semibold">Privacy Policy</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">Last updated: January 2026</p>

            <section>
              <h3 className="text-lg font-semibold">1. Information We Collect</h3>
              <p className="text-sm text-muted-foreground">
                We collect information you provide directly, including your name, email address, phone number, and payment information necessary to provide our services.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">2. How We Use Your Information</h3>
              <p className="text-sm text-muted-foreground">
                Your information is used to process transactions, provide customer support, send transaction notifications, and improve our services. We do not sell your personal information to third parties.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">3. Data Security</h3>
              <p className="text-sm text-muted-foreground">
                We implement industry-standard security measures to protect your data. All payment information is encrypted and processed through secure payment gateways.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">4. Third-Party Services</h3>
              <p className="text-sm text-muted-foreground">
                We work with trusted third-party providers (payment processors, telecom networks) to deliver our services. These partners have access only to information necessary to perform their functions.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">5. Cookies & Analytics</h3>
              <p className="text-sm text-muted-foreground">
                We use cookies and similar technologies to enhance your experience and collect usage analytics to improve our app.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">6. Data Retention</h3>
              <p className="text-sm text-muted-foreground">
                We retain your data for as long as your account is active or as needed to provide services. Transaction records are kept for regulatory compliance purposes.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">7. Your Rights</h3>
              <p className="text-sm text-muted-foreground">
                You have the right to access, correct, or delete your personal information. Contact us at harmicrecharge@harmicglobal.com to exercise these rights.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">8. Children's Privacy</h3>
              <p className="text-sm text-muted-foreground">
                Our services are not intended for users under 18. We do not knowingly collect information from children.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">9. Changes to This Policy</h3>
              <p className="text-sm text-muted-foreground">
                We may update this policy periodically. We will notify you of significant changes via email or app notification.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">10. Contact Us</h3>
              <p className="text-sm text-muted-foreground">
                For privacy-related inquiries, contact us at harmicrecharge@harmicglobal.com
              </p>
            </section>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          HARMIC RECHARGE v1.0.0
        </p>
      </main>
    </div>
  );
};

export default Privacy;
