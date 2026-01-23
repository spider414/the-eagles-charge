import { useWalletNotifications } from "@/hooks/useWalletNotifications";

/**
 * Component that initializes global wallet notifications
 * Should be rendered inside AuthProvider
 */
export const WalletNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  useWalletNotifications();
  return <>{children}</>;
};
