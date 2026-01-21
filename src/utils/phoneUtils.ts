import { NetworkType } from "@/components/NetworkSelector";

// Nigerian network prefixes
const networkPrefixes: Record<string, NetworkType> = {
  // MTN prefixes
  "0803": "mtn", "0806": "mtn", "0703": "mtn", "0706": "mtn",
  "0813": "mtn", "0816": "mtn", "0810": "mtn", "0814": "mtn",
  "0903": "mtn", "0906": "mtn", "0913": "mtn", "0916": "mtn",
  
  // Glo prefixes
  "0805": "glo", "0807": "glo", "0705": "glo", "0815": "glo",
  "0811": "glo", "0905": "glo", "0915": "glo",
  
  // Airtel prefixes
  "0802": "airtel", "0808": "airtel", "0708": "airtel", "0812": "airtel",
  "0701": "airtel", "0902": "airtel", "0901": "airtel", "0907": "airtel",
  "0912": "airtel",
  
  // 9mobile prefixes
  "0809": "9mobile", "0817": "9mobile", "0818": "9mobile", "0908": "9mobile",
  "0909": "9mobile",
};

export const detectNetwork = (phoneNumber: string): NetworkType | null => {
  const cleaned = phoneNumber.replace(/\D/g, "");
  
  // Check if number starts with country code
  let prefix = "";
  if (cleaned.startsWith("234")) {
    prefix = "0" + cleaned.slice(3, 6);
  } else if (cleaned.startsWith("0")) {
    prefix = cleaned.slice(0, 4);
  } else {
    return null;
  }
  
  return networkPrefixes[prefix] || null;
};

export const formatPhoneNumber = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("0")) {
    return cleaned;
  }
  if (cleaned.length === 13 && cleaned.startsWith("234")) {
    return "0" + cleaned.slice(3);
  }
  return cleaned;
};

export const getNetworkName = (network: NetworkType): string => {
  const names: Record<NetworkType, string> = {
    mtn: "MTN",
    glo: "Glo",
    airtel: "Airtel",
    "9mobile": "9mobile",
  };
  return names[network];
};
