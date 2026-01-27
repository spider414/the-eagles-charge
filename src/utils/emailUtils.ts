// Common email TLD typos to check against
const INVALID_TLDS = [
  'con', 'cmo', 'cm', 'ocm', 'om', 'comn', 'comm', 'coom',
  'nte', 'ent', 'ne', 'nte', 'neet',
  'ogr', 'og', 'orgg',
  'oi', 'iao',
];

// Common domain typos
const DOMAIN_TYPOS: Record<string, string> = {
  'gmal.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cmo': 'gmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'outloo.com': 'outlook.com',
  'outlook.con': 'outlook.com',
};

export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  
  const trimmed = email.trim().toLowerCase();
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return false;
  
  // Reject synthetic emails
  if (trimmed.endsWith('@eagles.local')) return false;
  
  // Check for common TLD typos
  const parts = trimmed.split('.');
  const tld = parts[parts.length - 1];
  if (INVALID_TLDS.includes(tld)) return false;
  
  // Check for common domain typos
  const domain = trimmed.split('@')[1];
  if (domain && DOMAIN_TYPOS[domain]) return false;
  
  return true;
};

export const getEmailSuggestion = (email: string): string | null => {
  if (!email) return null;
  
  const trimmed = email.trim().toLowerCase();
  const domain = trimmed.split('@')[1];
  
  if (domain && DOMAIN_TYPOS[domain]) {
    const localPart = trimmed.split('@')[0];
    return `${localPart}@${DOMAIN_TYPOS[domain]}`;
  }
  
  return null;
};
