import { useWalletNotifications } from "@/hooks/useWalletNotifications";
import { useNativeNotificationChannel } from "@/hooks/useNativeNotificationChannel";

/**
 * Component that initializes global wallet notifications
 * Should be rendered inside AuthProvider
 */
export const WalletNotificationProvider = ({ children }: { children: React.ReactNode }) => {
  useWalletNotifications();
  useNativeNotificationChannel();
  return <>{children}</>;
};
