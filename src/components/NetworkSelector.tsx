import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import mtnLogo from "@/assets/networks/mtn-logo.png";
import gloLogo from "@/assets/networks/glo-logo.png";
import airtelLogo from "@/assets/networks/airtel-logo.png";
import nineMobileLogo from "@/assets/networks/9mobile-logo.png";

export type NetworkType = "mtn" | "glo" | "airtel" | "9mobile";

interface NetworkSelectorProps {
  selected: NetworkType | null;
  onSelect: (network: NetworkType) => void;
}

const networks: { id: NetworkType; name: string; color: string; logo: string }[] = [
  { id: "mtn", name: "MTN", color: "bg-yellow-500", logo: mtnLogo },
  { id: "glo", name: "GLO", color: "bg-green-600", logo: gloLogo },
  { id: "airtel", name: "AIRTEL", color: "bg-red-600", logo: airtelLogo },
  { id: "9mobile", name: "9MOBILE", color: "bg-green-500", logo: nineMobileLogo },
];

const NetworkSelector = ({ selected, onSelect }: NetworkSelectorProps) => {
  const selectedNetwork = networks.find((n) => n.id === selected);

  return (
    <Select value={selected || ""} onValueChange={(value) => onSelect(value as NetworkType)}>
      <SelectTrigger className="w-full h-12">
        <SelectValue placeholder="Select Network">
          {selectedNetwork && (
            <div className="flex items-center gap-2">
              <img 
                src={selectedNetwork.logo} 
                alt={`${selectedNetwork.name} logo`}
                className="w-6 h-6 rounded object-contain"
              />
              <span className="font-medium">{selectedNetwork.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {networks.map((network) => (
          <SelectItem key={network.id} value={network.id} className="cursor-pointer">
            <div className="flex items-center gap-2">
              <img 
                src={network.logo} 
                alt={`${network.name} logo`}
                className="w-6 h-6 rounded object-contain"
              />
              <span className="font-medium">{network.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default NetworkSelector;
