import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ActivitySquare, CreditCard, Gift, LifeBuoy, Mail, Megaphone, ScanFace, ShieldCheck, UserCog, Users } from "lucide-react";
import AdminProviderBalance from "@/components/AdminProviderBalance";

export default function AdminOverview() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <AdminProviderBalance />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Users</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/users" className="flex items-center gap-2 text-primary hover:underline">
            <Users className="h-4 w-4" /> View registered users, balances and top up wallets
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Failed transaction recovery</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/recovery" className="flex items-center gap-2 text-primary hover:underline">
            <LifeBuoy className="h-4 w-4" /> Apologise, refund and let users retry failed purchases
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Promo campaigns</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/campaigns" className="flex items-center gap-2 text-primary hover:underline">
            <Megaphone className="h-4 w-4" /> Send email or SMS offers to all or selected users
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Email branding & logs</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/email" className="flex items-center gap-2 text-primary hover:underline">
            <Mail className="h-4 w-4" /> Manage templates and delivery logs
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">OTP audit log</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/otp" className="flex items-center gap-2 text-primary hover:underline">
            <ShieldCheck className="h-4 w-4" /> Review verification attempts
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Activity log</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/activity" className="flex items-center gap-2 text-primary hover:underline">
            <ActivitySquare className="h-4 w-4" /> Email sends, OTP events and role changes
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Role management</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/roles" className="flex items-center gap-2 text-primary hover:underline">
            <UserCog className="h-4 w-4" /> Grant or revoke admin access
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Billing</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/billing" className="flex items-center gap-2 text-primary hover:underline">
            <CreditCard className="h-4 w-4" /> Paystack payments and credit purchases
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">NIN verification</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/verification" className="flex items-center gap-2 text-primary hover:underline">
            <ScanFace className="h-4 w-4" /> Require or relax NIN identity checks at signup
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">New user registration bonus</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <Link to="/admin/bonus" className="flex items-center gap-2 text-primary hover:underline">
            <Gift className="h-4 w-4" /> Turn the signup bonus on/off and set the amount
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
