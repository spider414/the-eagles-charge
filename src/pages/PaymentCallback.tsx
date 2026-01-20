import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Bird, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaystack } from "@/hooks/usePaystack";

const PaymentCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyPayment } = usePaystack();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");

  const reference = searchParams.get("reference") || searchParams.get("trxref");

  useEffect(() => {
    const verify = async () => {
      if (!reference) {
        setStatus("failed");
        setMessage("No payment reference found");
        return;
      }

      const result = await verifyPayment(reference);

      if (result?.success) {
        setStatus("success");
        setMessage(result.message || "Payment successful!");
      } else {
        setStatus("failed");
        setMessage(result?.error || "Payment verification failed");
      }
    };

    verify();
  }, [reference]);

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
          <CardContent className="p-8 text-center">
            {status === "loading" && (
              <>
                <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin mb-4" />
                <CardTitle className="text-xl mb-2">Verifying Payment</CardTitle>
                <CardDescription>
                  Please wait while we confirm your payment...
                </CardDescription>
              </>
            )}

            {status === "success" && (
              <>
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <CardTitle className="text-xl mb-2 text-green-700">Payment Successful!</CardTitle>
                <CardDescription className="mb-6">
                  {message}
                </CardDescription>
                <div className="space-y-3">
                  <Button className="w-full" onClick={() => navigate("/dashboard")}>
                    Continue Shopping
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => navigate("/history")}>
                    View Transaction History
                  </Button>
                </div>
              </>
            )}

            {status === "failed" && (
              <>
                <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
                <CardTitle className="text-xl mb-2 text-red-700">Payment Failed</CardTitle>
                <CardDescription className="mb-6">
                  {message}
                </CardDescription>
                <div className="space-y-3">
                  <Button className="w-full" onClick={() => navigate("/dashboard")}>
                    Try Again
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => navigate("/history")}>
                    View Transaction History
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaymentCallback;
