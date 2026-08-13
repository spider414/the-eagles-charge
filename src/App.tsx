import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
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
import ExamPin from "./pages/ExamPin";
import TransactionDetail from "./pages/TransactionDetail";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import AdminLayout from "@/components/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminEmail from "./pages/admin/AdminEmail";
import AdminOtp from "./pages/admin/AdminOtp";
import AdminActivity from "./pages/admin/AdminActivity";
import AdminRoles from "./pages/admin/AdminRoles";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminBonus from "./pages/admin/AdminBonus";
import AdminBonusLog from "./pages/admin/AdminBonusLog";

const App = () => {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
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
                  <Route path="/exam-pin" element={<ExamPin />} />
                  <Route path="/transaction/:id" element={<TransactionDetail />} />
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminOverview />} />
                    <Route path="email" element={<AdminEmail />} />
                    <Route path="otp" element={<AdminOtp />} />
                    <Route path="activity" element={<AdminActivity />} />
                    <Route path="roles" element={<AdminRoles />} />
                    <Route path="billing" element={<AdminBilling />} />
                    <Route path="bonus" element={<AdminBonus />} />
                    <Route path="bonus-log" element={<AdminBonusLog />} />
                    <Route path="*" element={<AdminOverview />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </SessionLockProvider>
            </BrowserRouter>
          </TooltipProvider>
        </WalletNotificationProvider>
      </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
};

export default App;