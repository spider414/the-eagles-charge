import { forwardRef } from "react";
import { Wallet, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

export type PaymentMethod = "wallet" | "paystack";

interface PaymentMethodSelectorProps {
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  walletBalance: number;
  amount: number;
}

const PaymentMethodSelector = forwardRef<HTMLDivElement, PaymentMethodSelectorProps>(
  ({ selected, onSelect, walletBalance, amount }, ref) => {
    const canUseWallet = walletBalance >= amount && amount > 0;

    return (
      <div ref={ref} className="space-y-2">
        <p className="text-sm font-medium">Payment Method</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => canUseWallet && onSelect("wallet")}
            disabled={!canUseWallet}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              selected === "wallet" && canUseWallet
                ? "border-primary bg-primary/5"
                : canUseWallet
                ? "border-border hover:border-primary/50"
                : "border-border opacity-50 cursor-not-allowed"
            )}
          >
            <Wallet className={cn("h-6 w-6", selected === "wallet" && canUseWallet ? "text-primary" : "text-muted-foreground")} />
            <div className="text-center">
              <p className="text-sm font-medium">Wallet</p>
              <p className="text-xs text-muted-foreground">
                ₦{walletBalance.toLocaleString()}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onSelect("paystack")}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              selected === "paystack"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            )}
          >
            <CreditCard className={cn("h-6 w-6", selected === "paystack" ? "text-primary" : "text-muted-foreground")} />
            <div className="text-center">
              <p className="text-sm font-medium">Card/Bank</p>
              <p className="text-xs text-muted-foreground">Paystack</p>
            </div>
          </button>
        </div>
        
        {!canUseWallet && amount > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Insufficient wallet balance. Fund your wallet or pay with card.
          </p>
        )}
      </div>
    );
  }
);

PaymentMethodSelector.displayName = "PaymentMethodSelector";

export default PaymentMethodSelector;
