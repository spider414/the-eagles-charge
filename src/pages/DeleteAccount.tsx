import { Bird, Trash2, Clock, ShieldCheck, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DeleteAccount = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-gold">
              <Bird className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="font-semibold">HARMIC RECHARGE</span>
          </Link>
        </div>
      </header>

      <main className="container py-12 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-destructive/10">
              <Trash2 className="h-12 w-12 text-destructive" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Account Deletion Policy</h1>
          <p className="text-muted-foreground">
            Information about how to delete your HARMIC RECHARGE account
          </p>
        </div>

        <div className="space-y-6">
          {/* How to Delete */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                How to Delete Your Account
              </CardTitle>
              <CardDescription>
                Follow these steps to request account deletion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
                <li>Log in to your HARMIC RECHARGE account</li>
                <li>Navigate to <strong>Settings</strong> from the menu</li>
                <li>Scroll down to the <strong>Account</strong> section</li>
                <li>Click on <strong>"Delete Account"</strong></li>
                <li>Read the warning carefully and type <strong>DELETE</strong> to confirm</li>
                <li>Click the <strong>"Delete My Account"</strong> button</li>
              </ol>
              
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Alternatively, you can request account deletion by contacting our support team 
                  at <a href="mailto:henry4god99@gmail.com" className="text-primary underline">henry4god99@gmail.com</a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Deletion Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Deletion Timeline
              </CardTitle>
              <CardDescription>
                What happens after you request deletion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                <p className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
                  7-Day Grace Period
                </p>
                <p className="text-sm text-muted-foreground">
                  After you request account deletion, your account will be scheduled for 
                  permanent deletion after <strong>7 days</strong>. During this period:
                </p>
                <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>You can cancel the deletion by logging back into your account</li>
                  <li>Your account will be temporarily disabled</li>
                  <li>You cannot make any transactions</li>
                </ul>
              </div>
              
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                <p className="font-semibold text-destructive mb-2">
                  After 7 Days
                </p>
                <p className="text-sm text-muted-foreground">
                  Your account and all associated data will be permanently deleted. 
                  This action cannot be undone.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* What Gets Deleted */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Data That Will Be Deleted
              </CardTitle>
              <CardDescription>
                Complete list of data removed upon account deletion
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span><strong>Profile Information:</strong> Your name, email, phone number, and account settings</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span><strong>Transaction History:</strong> All records of airtime, data, and bill payments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span><strong>Wallet Balance:</strong> Any remaining balance in your wallet (non-refundable)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span><strong>Saved Numbers:</strong> Your favorite phone numbers and beneficiaries</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span><strong>Referral Data:</strong> Referral code, earnings, and referral history</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span><strong>Virtual Account:</strong> Your dedicated virtual account details (if created)</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Need Help?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                If you have questions about account deletion or need assistance, 
                please contact our support team:
              </p>
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Email:</strong>{" "}
                  <a href="mailto:henry4god99@gmail.com" className="text-primary underline">
                    henry4god99@gmail.com
                  </a>
                </p>
                <p className="text-sm">
                  <strong>Response Time:</strong> Within 24-48 hours
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Back to Home */}
          <div className="text-center pt-4">
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} HARMIC RECHARGE. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-2">
            <Link to="/privacy" className="hover:text-primary">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-primary">Terms of Service</Link>
          </div>
        </div>
      </main>
    </div>
  );
};

export default DeleteAccount;
