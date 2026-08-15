import { Link } from "react-router-dom";
import { AlertTriangle, MailWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCanTransact, gateMessage } from "@/hooks/useCanTransact";

/** Warns the user when suspension or an unverified email blocks all transactions. */
export default function TransactionGateBanner() {
  const { gate } = useCanTransact();
  if (!gate || gate.allowed) return null;

  const suspended = gate.reason === "account_suspended";

  return (
    <Alert variant="destructive" className="mb-3">
      {suspended ? <AlertTriangle className="h-4 w-4" /> : <MailWarning className="h-4 w-4" />}
      <AlertTitle className="text-sm">
        {suspended ? "Account suspended" : "Verify your email to continue"}
      </AlertTitle>
      <AlertDescription className="space-y-2 text-xs">
        <p>{gateMessage(gate.reason)}</p>
        {!suspended && (
          <Button asChild size="sm" variant="outline">
            <Link to="/settings">Verify email now</Link>
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
