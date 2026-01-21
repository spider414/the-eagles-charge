import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { NetworkType } from "@/components/NetworkSelector";

interface FavoriteNumber {
  id: string;
  phone_number: string;
  network: NetworkType;
  nickname: string | null;
  created_at: string;
}

export const useFavoriteNumbers = () => {
  const [favorites, setFavorites] = useState<FavoriteNumber[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchFavorites = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("favorite_numbers")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFavorites(data as FavoriteNumber[]);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addFavorite = async (phone_number: string, network: NetworkType, nickname?: string) => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from("favorite_numbers")
        .insert({
          user_id: user.id,
          phone_number,
          network,
          nickname: nickname || null,
        });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Already Saved",
            description: "This number is already in your favorites",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return false;
      }

      toast({
        title: "Number Saved",
        description: `${phone_number} has been added to your favorites`,
      });
      
      await fetchFavorites();
      return true;
    } catch (error) {
      console.error("Error adding favorite:", error);
      toast({
        title: "Error",
        description: "Failed to save number",
        variant: "destructive",
      });
      return false;
    }
  };

  const removeFavorite = async (id: string) => {
    try {
      const { error } = await supabase
        .from("favorite_numbers")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Number Removed",
        description: "The number has been removed from your favorites",
      });
      
      await fetchFavorites();
      return true;
    } catch (error) {
      console.error("Error removing favorite:", error);
      toast({
        title: "Error",
        description: "Failed to remove number",
        variant: "destructive",
      });
      return false;
    }
  };

  const isFavorite = (phone_number: string): boolean => {
    return favorites.some((f) => f.phone_number === phone_number);
  };

  useEffect(() => {
    fetchFavorites();
  }, [user]);

  return {
    favorites,
    isLoading,
    addFavorite,
    removeFavorite,
    isFavorite,
    refetch: fetchFavorites,
  };
};
