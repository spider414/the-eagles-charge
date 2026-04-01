import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { WalletNotificationProvider } from "@/components/WalletNotificationProvider";
import FloatingChatButton from "@/components/FloatingChatButton";
import { SessionLockProvider } from "@/components/SessionLockProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Airtime from "./pages/Airtime";
import Data from "./pages/Data";
import History from "./pages/History";
import Referrals from "./pages/Referrals";
import ComingSoon from "./pages/ComingSoon";

import Electricity from "./pages/bills/Electricity";
import CableTV from "./pages/bills/CableTV";
import Internet from "./pages/bills/Internet";
import PaymentCallback from "./pages/PaymentCallback";
import WalletTopUp from "./pages/WalletTopUp";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Support from "./pages/Support";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import DeleteAccount from "./pages/DeleteAccount";
import Verification from "./pages/Verification";
import BvnPrint from "./pages/BvnPrint";
import NinPrint from "./pages/NinPrint";
import VerificationHistory from "./pages/VerificationHistory";
import TransactionDetail from "./pages/TransactionDetail";
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
              <FloatingChatButton />
              <SessionLockProvider>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/airtime" element={<Airtime />} />
                  <Route path="/data" element={<Data />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/referrals" element={<Referrals />} />
                  <Route path="/coming-soon" element={<ComingSoon />} />
                  
                  <Route path="/bills/electricity" element={<Electricity />} />
                  <Route path="/bills/cable" element={<CableTV />} />
                  <Route path="/bills/internet" element={<Internet />} />
                  <Route path="/payment/callback" element={<PaymentCallback />} />
                  <Route path="/wallet/topup" element={<WalletTopUp />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/support" element={<Support />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/delete-account" element={<DeleteAccount />} />
                  <Route path="/verification" element={<Verification />} />
                  <Route path="/bvn-print" element={<BvnPrint />} />
                  <Route path="/nin-print" element={<NinPrint />} />
                  <Route path="/verification-history" element={<VerificationHistory />} />
                  <Route path="/transaction/:id" element={<TransactionDetail />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </SessionLockProvider>
            </BrowserRouter>
          </TooltipProvider>
        </WalletNotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;