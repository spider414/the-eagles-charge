import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WalletNotificationProvider } from "@/components/WalletNotificationProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import Referrals from "./pages/Referrals";
import Electricity from "./pages/bills/Electricity";
import CableTV from "./pages/bills/CableTV";
import Internet from "./pages/bills/Internet";
import PaymentCallback from "./pages/PaymentCallback";
import WalletTopUp from "./pages/WalletTopUp";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WalletNotificationProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<History />} />
                <Route path="/referrals" element={<Referrals />} />
                <Route path="/bills/electricity" element={<Electricity />} />
                <Route path="/bills/cable" element={<CableTV />} />
                <Route path="/bills/internet" element={<Internet />} />
                <Route path="/payment/callback" element={<PaymentCallback />} />
                <Route path="/wallet/topup" element={<WalletTopUp />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </WalletNotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;