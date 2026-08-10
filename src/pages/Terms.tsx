import { useNavigate } from "react-router-dom";
import { Bird, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Terms = () => {
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
            <span className="font-semibold">Terms & Conditions</span>
          </div>
        </div>
      </header>

      <main className="container py-6 max-w-lg mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none space-y-4">
            <p className="text-muted-foreground">Last updated: January 2026</p>

            <section>
              <h3 className="text-lg font-semibold">1. Acceptance of Terms</h3>
              <p className="text-sm text-muted-foreground">
                By accessing and using HARMIC RECHARGE application, you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use our services.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">2. Services</h3>
              <p className="text-sm text-muted-foreground">
                HARMIC RECHARGE provides digital services including but not limited to airtime top-up, data bundle purchases, electricity bill payments, cable TV subscriptions, and internet subscriptions.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">3. User Account</h3>
              <p className="text-sm text-muted-foreground">
                You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">4. Payments & Refunds</h3>
              <p className="text-sm text-muted-foreground">
                All payments are processed securely through our payment partners. Failed transactions are automatically refunded to your wallet. Successful transactions are non-refundable unless the service was not delivered.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">5. Wallet Funds</h3>
              <p className="text-sm text-muted-foreground">
                Funds deposited into your wallet are non-refundable and can only be used for purchases within the app. We reserve the right to freeze accounts suspected of fraudulent activity.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">6. Service Availability</h3>
              <p className="text-sm text-muted-foreground">
                While we strive to maintain 24/7 service availability, we do not guarantee uninterrupted access. Service may be temporarily unavailable due to maintenance or factors beyond our control.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">7. Limitation of Liability</h3>
              <p className="text-sm text-muted-foreground">
                HARMIC RECHARGE shall not be liable for any indirect, incidental, or consequential damages arising from the use of our services.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">8. Changes to Terms</h3>
              <p className="text-sm text-muted-foreground">
                We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">9. Contact</h3>
              <p className="text-sm text-muted-foreground">
                For questions about these Terms, please contact us at harmicrecharge@harmicglobal.com
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

export default Terms;
