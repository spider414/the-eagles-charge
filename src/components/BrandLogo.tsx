import harmicLogo from "@/assets/harmic-logo.jpg.asset.json";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  rounded?: string;
  alt?: string;
}

/** Single source of truth for the HARMIC RECHARGE brand mark. */
const BrandLogo = ({ className, rounded = "rounded-xl", alt = "HARMIC RECHARGE logo" }: BrandLogoProps) => (
  <img
    src={harmicLogo.url}
    alt={alt}
    loading="lazy"
    className={cn("object-cover shadow-gold shrink-0", rounded, className ?? "h-10 w-10")}
  />
);

export default BrandLogo;
