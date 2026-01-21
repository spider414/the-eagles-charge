import { useState } from "react";
import { Star, Trash2, User, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFavoriteNumbers } from "@/hooks/useFavoriteNumbers";
import { NetworkType } from "@/components/NetworkSelector";
import { getNetworkName } from "@/utils/phoneUtils";
import { cn } from "@/lib/utils";

interface FavoriteNumbersSelectorProps {
  onSelect: (phone: string, network: NetworkType) => void;
  currentPhone?: string;
  currentNetwork?: NetworkType | null;
  onSaveCurrentNumber?: () => void;
  canSave?: boolean;
}

const networkColors: Record<NetworkType, string> = {
  mtn: "bg-yellow-500",
  glo: "bg-green-500",
  airtel: "bg-red-500",
  "9mobile": "bg-green-700",
};

const FavoriteNumbersSelector = ({
  onSelect,
  currentPhone,
  currentNetwork,
  onSaveCurrentNumber,
  canSave = false,
}: FavoriteNumbersSelectorProps) => {
  const { favorites, removeFavorite, isLoading, isFavorite } = useFavoriteNumbers();
  const [isExpanded, setIsExpanded] = useState(false);

  if (favorites.length === 0 && !canSave) {
    return null;
  }

  const showSaveButton = canSave && currentPhone && currentPhone.length === 11 && currentNetwork && !isFavorite(currentPhone);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-2">
          <Star className="h-4 w-4" />
          Saved Numbers ({favorites.length})
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
          {showSaveButton && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSaveCurrentNumber}
              className="w-full justify-start gap-2 border-dashed"
            >
              <Star className="h-4 w-4" />
              Save current number
            </Button>
          )}

          {isLoading ? (
            <div className="text-center py-2 text-sm text-muted-foreground">
              Loading...
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-2 text-sm text-muted-foreground">
              No saved numbers yet
            </div>
          ) : (
            <div className="grid gap-2">
              {favorites.map((fav) => (
                <div
                  key={fav.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer hover:border-primary/50",
                    currentPhone === fav.phone_number && currentNetwork === fav.network
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  )}
                  onClick={() => onSelect(fav.phone_number, fav.network)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold", networkColors[fav.network])}>
                      {getNetworkName(fav.network).slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-medium">{fav.phone_number}</p>
                      {fav.nickname && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {fav.nickname}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavorite(fav.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FavoriteNumbersSelector;
