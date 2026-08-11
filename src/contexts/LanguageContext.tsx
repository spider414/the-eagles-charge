import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { LANGUAGES, LanguageCode, TranslationKey, translations } from "@/i18n/translations";

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  languages: typeof LANGUAGES;
}

const STORAGE_KEY = "appLanguage";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const isSupported = (value: string | null): value is LanguageCode =>
  !!value && LANGUAGES.some((l) => l.code === value);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    return isSupported(stored) ? stored : "en";
  });

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    localStorage.setItem(STORAGE_KEY, code);
    setLanguageState(code);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => {
      const dict = translations[language] as Record<string, string>;
      return dict?.[key] ?? (translations.en as Record<string, string>)[key] ?? key;
    },
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t, languages: LANGUAGES }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
};
