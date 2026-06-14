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

// Updated fallback plans with CheapDataHub bundle IDs
const fallbackPlans: Record<NetworkType, DataPlan[]> = {
  mtn: [
    { id: "43", name: "110MB - 1 Day", size: "110MB", price: 99, validity: "1 Day", variation_id: "43" },
    { id: "74", name: "230MB - 1 Day", size: "230MB", price: 200, validity: "1 Day", variation_id: "74" },
    { id: "76", name: "500MB SME - 2 Days", size: "500MB", price: 250, validity: "2 Days", variation_id: "76" },
    { id: "78", name: "1GB SME - 1 Day", size: "1GB", price: 280, validity: "1 Day", variation_id: "78" },
    { id: "44", name: "500MB SME - 30 Days", size: "500MB", price: 350, validity: "30 Days", variation_id: "44" },
    { id: "77", name: "1GB SME - 2 Days", size: "1GB", price: 399, validity: "2 Days", variation_id: "77" },
    { id: "45", name: "1GB SME - 7 Days", size: "1GB", price: 450, validity: "7 Days", variation_id: "45" },
    { id: "46", name: "1GB SME - 30 Days", size: "1GB", price: 570, validity: "30 Days", variation_id: "46" },
    { id: "79", name: "2.5GB SME - 1 Day", size: "2.5GB", price: 600, validity: "1 Day", variation_id: "79" },
    { id: "71", name: "2GB Gifting - 7 Days", size: "2GB", price: 900, validity: "7 Days", variation_id: "71" },
    { id: "27", name: "2.5GB - 2 Days", size: "2.5GB", price: 900, validity: "2 Days", variation_id: "27" },
    { id: "47", name: "2GB SME - 7 Days", size: "2GB", price: 930, validity: "7 Days", variation_id: "47" },
    { id: "60", name: "3.5GB - 1 Day", size: "3.5GB", price: 980, validity: "1 Day", variation_id: "60" },
    { id: "48", name: "2GB SME - 30 Days", size: "2GB", price: 1150, validity: "30 Days", variation_id: "48" },
    { id: "61", name: "4GB - 2 Days", size: "4GB", price: 1175, validity: "2 Days", variation_id: "61" },
    { id: "80", name: "5GB Corporate Gifting - 14 Days", size: "5GB", price: 1299, validity: "14 Days", variation_id: "80" },
    { id: "49", name: "3GB SME - 30 Days", size: "3GB", price: 1370, validity: "30 Days", variation_id: "49" },
    { id: "50", name: "5GB SME - 30 Days", size: "5GB", price: 2050, validity: "30 Days", variation_id: "50" },
    { id: "53", name: "6GB Gifting - 7 Days", size: "6GB", price: 2495, validity: "7 Days", variation_id: "53" },
    { id: "55", name: "11GB Gifting - 7 Days", size: "11GB", price: 3430, validity: "7 Days", variation_id: "55" },
    { id: "33", name: "7GB Gifting - 30 Days", size: "7GB", price: 3499, validity: "30 Days", variation_id: "33" },
    { id: "67", name: "10GB Gifting - 30 Days", size: "10GB", price: 4470, validity: "30 Days", variation_id: "67" },
    { id: "57", name: "36GB Gifting - 30 Days", size: "36GB", price: 10800, validity: "30 Days", variation_id: "57" },
    { id: "51", name: "75GB SME - 30 Days", size: "75GB", price: 17990, validity: "30 Days", variation_id: "51" },
  ],
  glo: [
    { id: "42", name: "200MB Corporate Gifting - 1 Day", size: "200MB", price: 92, validity: "1 Day", variation_id: "42" },
    { id: "35", name: "500MB Corporate Gifting - 30 Days", size: "500MB", price: 225, validity: "30 Days", variation_id: "35" },
    { id: "68", name: "1GB Corporate Gifting - 3 Days", size: "1GB", price: 300, validity: "3 Days", variation_id: "68" },
    { id: "36", name: "1GB Corporate Gifting - 30 Days", size: "1GB", price: 425, validity: "30 Days", variation_id: "36" },
    { id: "41", name: "1GB Gifting - 14 Days", size: "1GB", price: 485, validity: "14 Days", variation_id: "41" },
    { id: "40", name: "2GB Corporate Gifting - 30 Days", size: "2GB", price: 850, validity: "30 Days", variation_id: "40" },
    { id: "37", name: "3GB Corporate Gifting - 30 Days", size: "3GB", price: 1300, validity: "30 Days", variation_id: "37" },
    { id: "54", name: "5GB Corporate Gifting - 7 Days", size: "5GB", price: 1699, validity: "7 Days", variation_id: "54" },
    { id: "38", name: "5GB Corporate Gifting - 30 Days", size: "5GB", price: 2250, validity: "30 Days", variation_id: "38" },
    { id: "39", name: "10GB Corporate Gifting - 30 Days", size: "10GB", price: 4390, validity: "30 Days", variation_id: "39" },
    { id: "59", name: "20.5GB Gifting - 30 Days", size: "20.5GB", price: 5300, validity: "30 Days", variation_id: "59" },
    { id: "58", name: "107GB Gifting - 30 Days", size: "107GB", price: 19300, validity: "30 Days", variation_id: "58" },
  ],
  airtel: [
    { id: "70", name: "1GB Social Bundle Gifting - 3 Days", size: "1GB", price: 295, validity: "3 Days", variation_id: "70" },
    { id: "13", name: "500MB Gifting - 7 Days", size: "500MB", price: 490, validity: "7 Days", variation_id: "13" },
    { id: "69", name: "1.5GB Gifting - 1 Day", size: "1.5GB", price: 500, validity: "1 Day", variation_id: "69" },
    { id: "66", name: "1.5GB Gifting - 2 Days", size: "1.5GB", price: 599, validity: "2 Days", variation_id: "66" },
    { id: "15", name: "1GB Gifting - 7 Days", size: "1GB", price: 785, validity: "7 Days", variation_id: "15" },
    { id: "17", name: "2GB Gifting - 30 Days", size: "2GB", price: 1470, validity: "30 Days", variation_id: "17" },
    { id: "52", name: "5GB Gifting - 7 Days", size: "5GB", price: 1570, validity: "7 Days", variation_id: "52" },
    { id: "18", name: "3GB Gifting - 30 Days", size: "3GB", price: 1960, validity: "30 Days", variation_id: "18" },
    { id: "22", name: "6GB SME - 7 Days", size: "6GB", price: 2455, validity: "7 Days", variation_id: "22" },
    { id: "19", name: "4GB Gifting - 30 Days", size: "4GB", price: 2570, validity: "30 Days", variation_id: "19" },
    { id: "20", name: "8GB Gifting - 30 Days", size: "8GB", price: 2999, validity: "30 Days", variation_id: "20" },
    { id: "21", name: "10GB Gifting - 30 Days", size: "10GB", price: 4070, validity: "30 Days", variation_id: "21" },
  ],
  // 9mobile data plans are currently unavailable on CheapDataHub
  "9mobile": [],
};

// Cache for data plans
const plansCache: Record<string, { plans: DataPlan[]; timestamp: number }> = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Flag to enable/disable API fetching - using hardcoded plans from edge function
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
