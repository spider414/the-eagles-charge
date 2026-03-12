import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InternetPlan {
  id: string;
  name: string;
  price: number;
  data: string;
  validity: string;
  variation_code?: string;
}

// Fallback plans when API is unavailable
const fallbackPlans: Record<string, InternetPlan[]> = {
  smile: [
    { id: "smile-1", name: "Smile 1.5GB", price: 1000, data: "1.5GB", validity: "30 Days" },
    { id: "smile-2", name: "Smile 3GB", price: 1500, data: "3GB", validity: "30 Days" },
    { id: "smile-3", name: "Smile 6.5GB", price: 2500, data: "6.5GB", validity: "30 Days" },
    { id: "smile-4", name: "Smile 10GB", price: 3500, data: "10GB", validity: "30 Days" },
  ],
  spectranet: [
    { id: "spectranet-1", name: "Spectranet 7GB", price: 3000, data: "7GB", validity: "30 Days" },
    { id: "spectranet-2", name: "Spectranet 15GB", price: 5000, data: "15GB", validity: "30 Days" },
    { id: "spectranet-3", name: "Spectranet 30GB", price: 8000, data: "30GB", validity: "30 Days" },
    { id: "spectranet-4", name: "Spectranet Unlimited", price: 15000, data: "Unlimited", validity: "30 Days" },
  ],
  ipnx: [
    { id: "ipnx-1", name: "iPNX Bronze 15Mbps", price: 12000, data: "Unlimited", validity: "30 Days" },
    { id: "ipnx-2", name: "iPNX Silver 25Mbps", price: 18000, data: "Unlimited", validity: "30 Days" },
    { id: "ipnx-3", name: "iPNX Gold 50Mbps", price: 25000, data: "Unlimited", validity: "30 Days" },
    { id: "ipnx-4", name: "iPNX Platinum 100Mbps", price: 45000, data: "Unlimited", validity: "30 Days" },
  ],
  swift: [
    { id: "swift-1", name: "Swift 7GB", price: 3000, data: "7GB", validity: "30 Days" },
    { id: "swift-2", name: "Swift 15GB", price: 5500, data: "15GB", validity: "30 Days" },
    { id: "swift-3", name: "Swift 30GB", price: 9000, data: "30GB", validity: "30 Days" },
    { id: "swift-4", name: "Swift Unlimited", price: 16000, data: "Unlimited", validity: "30 Days" },
  ],
  ntel: [
    { id: "ntel-1", name: "ntel 5GB", price: 2500, data: "5GB", validity: "30 Days" },
    { id: "ntel-2", name: "ntel 10GB", price: 4500, data: "10GB", validity: "30 Days" },
    { id: "ntel-3", name: "ntel 20GB", price: 7000, data: "20GB", validity: "30 Days" },
    { id: "ntel-4", name: "ntel Unlimited", price: 12000, data: "Unlimited", validity: "30 Days" },
  ],
};

// Cache for plans
const plansCache: Record<string, { plans: InternetPlan[]; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export const useInternetPlans = () => {
  const [plans, setPlans] = useState<InternetPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async (provider: string): Promise<InternetPlan[]> => {
    if (!provider) {
      setPlans([]);
      return [];
    }

    // Check cache first
    const cached = plansCache[provider];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPlans(cached.plans);
      return cached.plans;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke("internet-plans", {
        body: { provider },
      });

      if (fetchError) throw fetchError;

      if (data?.success && data.data?.length > 0) {
        const fetchedPlans: InternetPlan[] = data.data;

        plansCache[provider] = {
          plans: fetchedPlans,
          timestamp: Date.now(),
        };

        setPlans(fetchedPlans);
        return fetchedPlans;
      } else {
        // Use fallback
        console.warn("Using fallback plans for", provider);
        const fallback = fallbackPlans[provider] || [];
        setPlans(fallback);
        return fallback;
      }
    } catch (err) {
      console.error("Failed to fetch internet plans:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch plans");

      const fallback = fallbackPlans[provider] || [];
      setPlans(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    Object.keys(plansCache).forEach((key) => delete plansCache[key]);
  }, []);

  return { plans, isLoading, error, fetchPlans, clearCache };
};
