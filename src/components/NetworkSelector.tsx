import { cn } from "@/lib/utils";

export type NetworkType = "mtn" | "glo" | "airtel" | "9mobile";

interface NetworkSelectorProps {
  selected: NetworkType | null;
  onSelect: (network: NetworkType) => void;
}

const networks: { id: NetworkType; name: string; className: string }[] = [
  { id: "mtn", name: "MTN", className: "network-mtn" },
  { id: "glo", name: "GLO", className: "network-glo" },
  { id: "airtel", name: "AIRTEL", className: "network-airtel" },
  { id: "9mobile", name: "9MOBILE", className: "network-9mobile" },
];

const NetworkSelector = ({ selected, onSelect }: NetworkSelectorProps) => {
  return (
    <div className="grid grid-cols-4 gap-3">
      {networks.map((network) => (
        <button
          key={network.id}
          onClick={() => onSelect(network.id)}
          className={cn(
            "relative flex flex-col items-center justify-center p-4 rounded-xl transition-all duration-200",
            network.className,
            selected === network.id
              ? "ring-4 ring-offset-2 ring-offset-background ring-foreground/20 scale-105"
              : "hover:scale-105 opacity-80 hover:opacity-100"
          )}
        >
          <span className="text-xs md:text-sm font-bold text-white drop-shadow-sm">
            {network.name}
          </span>
        </button>
      ))}
    </div>
  );
};

export default NetworkSelector;
