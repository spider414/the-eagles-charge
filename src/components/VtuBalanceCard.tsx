import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, AlertTriangle, CheckCircle, Wallet } from "lucide-react";
import { useVtuBalance } from "@/hooks/useVtuBalance";

interface VtuBalanceCardProps {
  lowBalanceThreshold?: number;
}

const VtuBalanceCard = ({ lowBalanceThreshold = 5000 }: VtuBalanceCardProps) => {
  const { balance, isLoading, checkBalance } = useVtuBalance();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    // Initial check
    checkBalance();
    
    // Auto-refresh every 5 minutes if enabled
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(checkBalance, 5 * 60 * 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [checkBalance, autoRefresh]);

  const isLowBalance = balance && balance.balance < lowBalanceThreshold;
  const balancePercentage = balance 
    ? Math.min((balance.balance / 50000) * 100, 100) 
    : 0;

  const getStatusBadge = () => {
    if (!balance) return null;
    
    if (balance.balance < 1000) {
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Critical
        </Badge>
      );
    }
    if (isLowBalance) {
      return (
        <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-600">
          <AlertTriangle className="h-3 w-3" />
          Low
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1 bg-green-500/20 text-green-600">
        <CheckCircle className="h-3 w-3" />
        Healthy
      </Badge>
    );
  };

  return (
    <Card className={isLowBalance ? "border-yellow-500/50" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">VTU API Balance</CardTitle>
          </div>
          {getStatusBadge()}
        </div>
        <CardDescription>CheapDataHub API credits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-bold">
              {balance ? `₦${balance.balance.toLocaleString()}` : "---"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkBalance}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
          
          <Progress value={balancePercentage} className="h-2" />
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>₦0</span>
            <span>₦50,000</span>
          </div>
        </div>

        {isLowBalance && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-600">Low Balance Alert</p>
                <p className="text-muted-foreground">
                  Balance is below ₦{lowBalanceThreshold.toLocaleString()}. 
                  Top up your CheapDataHub account to avoid service disruption.
                </p>
              </div>
            </div>
          </div>
        )}

        {balance && (
          <p className="text-xs text-muted-foreground">
            Last checked: {balance.lastChecked.toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default VtuBalanceCard;
