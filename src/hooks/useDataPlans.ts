import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NetworkType } from "@/components/NetworkSelector";

export interface DataPlan {
  id: string;
  name: string;
  size: string;
  price: number;
  validity: string;
  variation_id: string;
}

// Fallback plans if API fails
const fallbackPlans: Record<NetworkType, DataPlan[]> = {
  mtn: [
    { id: "mtn-500mb", name: "500MB", size: "500MB", price: 150, validity: "30 days", variation_id: "mtn-500mb" },
    { id: "mtn-1gb", name: "1GB", size: "1GB", price: 300, validity: "30 days", variation_id: "mtn-1gb" },
    { id: "mtn-2gb", name: "2GB", size: "2GB", price: 500, validity: "30 days", variation_id: "mtn-2gb" },
    { id: "mtn-3gb", name: "3GB", size: "3GB", price: 800, validity: "30 days", variation_id: "mtn-3gb" },
    { id: "mtn-5gb", name: "5GB", size: "5GB", price: 1200, validity: "30 days", variation_id: "mtn-5gb" },
    { id: "mtn-10gb", name: "10GB", size: "10GB", price: 2500, validity: "30 days", variation_id: "mtn-10gb" },
  ],
  glo: [
    { id: "glo-500mb", name: "500MB", size: "500MB", price: 100, validity: "30 days", variation_id: "glo-500mb" },
    { id: "glo-1gb", name: "1GB", size: "1GB", price: 200, validity: "30 days", variation_id: "glo-1gb" },
    { id: "glo-2gb", name: "2GB", size: "2GB", price: 400, validity: "30 days", variation_id: "glo-2gb" },
    { id: "glo-5gb", name: "5GB", size: "5GB", price: 1000, validity: "30 days", variation_id: "glo-5gb" },
    { id: "glo-10gb", name: "10GB", size: "10GB", price: 2000, validity: "30 days", variation_id: "glo-10gb" },
  ],
  airtel: [
    { id: "airtel-500mb", name: "500MB", size: "500MB", price: 150, validity: "30 days", variation_id: "airtel-500mb" },
    { id: "airtel-1gb", name: "1GB", size: "1GB", price: 300, validity: "30 days", variation_id: "airtel-1gb" },
    { id: "airtel-2gb", name: "2GB", size: "2GB", price: 500, validity: "30 days", variation_id: "airtel-2gb" },
    { id: "airtel-5gb", name: "5GB", size: "5GB", price: 1200, validity: "30 days", variation_id: "airtel-5gb" },
    { id: "airtel-10gb", name: "10GB", size: "10GB", price: 2500, validity: "30 days", variation_id: "airtel-10gb" },
  ],
  "9mobile": [
    { id: "9mobile-500mb", name: "500MB", size: "500MB", price: 100, validity: "30 days", variation_id: "9mobile-500mb" },
    { id: "9mobile-1gb", name: "1GB", size: "1GB", price: 200, validity: "30 days", variation_id: "9mobile-1gb" },
    { id: "9mobile-2.5gb", name: "2.5GB", size: "2.5GB", price: 500, validity: "30 days", variation_id: "9mobile-2.5gb" },
    { id: "9mobile-5gb", name: "5GB", size: "5GB", price: 1000, validity: "30 days", variation_id: "9mobile-5gb" },
    { id: "9mobile-11.5gb", name: "11.5GB", size: "11.5GB", price: 2000, validity: "30 days", variation_id: "9mobile-11.5gb" },
  ],
};

// Cache for data plans
const plansCache: Record<string, { plans: DataPlan[]; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Flag to enable/disable API fetching - set to true to use CheapDataHub API
const USE_API_FETCH = true;

export const useDataPlans = () => {
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlans = useCallback(async (network: NetworkType): Promise<DataPlan[]> => {
    // Check cache first
    const cached = plansCache[network];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPlans(cached.plans);
      return cached.plans;
    }

    // If API fetch is disabled, use fallback plans immediately
    if (!USE_API_FETCH) {
      const fallback = fallbackPlans[network] || [];
      setPlans(fallback);
      
      // Cache the fallback plans
      plansCache[network] = {
        plans: fallback,
        timestamp: Date.now(),
      };
      
      return fallback;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase.functions.invoke("vtu-service", {
        body: { action: "data_plans", network },
      });

      if (fetchError) throw fetchError;

      if (data.success && data.data?.length > 0) {
        const fetchedPlans: DataPlan[] = data.data;
        
        // Cache the results
        plansCache[network] = {
          plans: fetchedPlans,
          timestamp: Date.now(),
        };
        
        setPlans(fetchedPlans);
        return fetchedPlans;
      } else {
        // Use fallback plans
        console.warn("Using fallback plans for", network);
        const fallback = fallbackPlans[network] || [];
        setPlans(fallback);
        return fallback;
      }
    } catch (err) {
      console.error("Failed to fetch data plans:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch plans");
      
      // Use fallback plans on error
      const fallback = fallbackPlans[network] || [];
      setPlans(fallback);
      return fallback;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(() => {
    Object.keys(plansCache).forEach(key => delete plansCache[key]);
  }, []);

  return {
    plans,
    isLoading,
    error,
    fetchPlans,
    clearCache,
    fallbackPlans,
  };
};
