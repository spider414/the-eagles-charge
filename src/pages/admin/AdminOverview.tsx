import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ActivitySquare, CreditCard, Gift, Mail, ShieldCheck, UserCog, Users } from "lucide-react";

export default function AdminOverview() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
