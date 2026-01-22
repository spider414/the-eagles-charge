import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type NetworkType = "mtn" | "glo" | "airtel" | "9mobile";

interface NetworkSelectorProps {
  selected: NetworkType | null;
  onSelect: (network: NetworkType) => void;
}

const networks: { id: NetworkType; name: string; color: string }[] = [
  { id: "mtn", name: "MTN", color: "bg-yellow-500" },
  { id: "glo", name: "GLO", color: "bg-green-600" },
  { id: "airtel", name: "AIRTEL", color: "bg-red-600" },
  { id: "9mobile", name: "9MOBILE", color: "bg-green-500" },
];

const NetworkSelector = ({ selected, onSelect }: NetworkSelectorProps) => {
  const selectedNetwork = networks.find((n) => n.id === selected);

  return (
    <Select value={selected || ""} onValueChange={(value) => onSelect(value as NetworkType)}>
      <SelectTrigger className="w-full h-12">
        <SelectValue placeholder="Select Network">
          {selectedNetwork && (
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${selectedNetwork.color}`} />
              <span className="font-medium">{selectedNetwork.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="bg-popover z-50">
        {networks.map((network) => (
          <SelectItem key={network.id} value={network.id} className="cursor-pointer">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${network.color}`} />
              <span className="font-medium">{network.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default NetworkSelector;
