import type { LanguageCode } from "@/i18n/translations";

/** Intl locale tags used for number formatting per app language. */
const NUMBER_LOCALES: Record<LanguageCode, string> = {
  en: "en-NG",
  pcm: "en-NG",
  yo: "yo-NG",
  ig: "ig-NG",
  ha: "ha-NG",
};

const safeLocale = (language: LanguageCode) => {
  const tag = NUMBER_LOCALES[language] || "en-NG";
  try {
    new Intl.NumberFormat(tag);
    return tag;
  } catch {
    return "en-NG";
  }
};

const MONTHS: Record<LanguageCode, string[]> = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  pcm: ["Jan", "Feb", "Mach", "Apr", "May", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"],
  yo: ["Ṣẹ́r", "Èrl", "Ẹrn", "Ìgb", "Ẹ̀bi", "Òkú", "Agẹ", "Ògú", "Owe", "Ọ̀wà", "Bél", "Ọ̀pẹ"],
  ig: ["Jen", "Feb", "Maa", "Epr", "Mee", "Jun", "Jul", "Ọgọ", "Sep", "Ọkt", "Nov", "Dis"],
  ha: ["Jan", "Fab", "Mar", "Afr", "May", "Yun", "Yul", "Agu", "Sat", "Okt", "Nuw", "Dis"],
};

const AT_WORD: Record<LanguageCode, string> = {
  en: "at",
  pcm: "for",
  yo: "ní",
  ig: "na",
  ha: "da",
};

export const formatNumber = (value: number, language: LanguageCode, options?: Intl.NumberFormatOptions) => {
  const n = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat(safeLocale(language), options).format(n);
  } catch {
    return n.toLocaleString("en-NG", options);
  }
};

/** Naira amount, always rendered with the ₦ symbol and 2 decimals when needed. */
export const formatCurrency = (value: number | null | undefined, language: LanguageCode) => {
  const n = Number(value) || 0;
  const hasKobo = Math.abs(n % 1) > 0.004;
  return `₦${formatNumber(n, language, {
    minimumFractionDigits: hasKobo ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

const pad = (n: number) => String(n).padStart(2, "0");

export const formatDate = (input: string | number | Date, language: LanguageCode) => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  return `${MONTHS[language][d.getMonth()]} ${pad(d.getDate())}, ${d.getFullYear()}`;
};

export const formatTime = (input: string | number | Date, language: LanguageCode) => {
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(safeLocale(language), { hour: "numeric", minute: "2-digit" }).format(d);
  } catch {
    const h = d.getHours() % 12 || 12;
    return `${h}:${pad(d.getMinutes())} ${d.getHours() >= 12 ? "PM" : "AM"}`;
  }
};

export const formatDateTime = (input: string | number | Date, language: LanguageCode) => {
  const date = formatDate(input, language);
  if (!date) return "";
  return `${date} ${AT_WORD[language]} ${formatTime(input, language)}`;
};
