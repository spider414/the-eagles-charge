import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Mail, ShieldCheck } from "lucide-react";

export default function AdminOverview() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
    </div>
  );
}
