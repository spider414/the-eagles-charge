import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/contexts/LanguageContext";
import type { LanguageCode } from "@/i18n/translations";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  className?: string;
  /** Show the short language code next to the icon. */
  showCode?: boolean;
}

const LanguageSwitcher = ({ className, showCode = true }: LanguageSwitcherProps) => {
  const { language, setLanguage, languages, t } = useLanguage();
  const current = languages.find((l) => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-9 px-2 gap-1.5 text-muted-foreground hover:text-foreground", className)}
          aria-label={t("settings.language")}
        >
          <Languages className="h-4 w-4" />
          {showCode && <span className="text-xs font-medium uppercase">{current?.code}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 bg-popover z-[60]">
        <DropdownMenuLabel>{t("settings.language")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as LanguageCode)}
            className={cn("cursor-pointer", lang.code === language && "font-semibold text-primary")}
          >
            {lang.native}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSwitcher;
