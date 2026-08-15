// Shared helper: compares the name a user typed at signup with the name on
// their NIN record. Tolerates ordering, middle names, punctuation and case.
export function normalizeName(raw: string): string[] {
  return (raw || "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function namesMatch(typed: string, official: string): boolean {
  const a = normalizeName(typed);
  const b = normalizeName(official);
  if (a.length === 0 || b.length === 0) return false;
  const overlap = a.filter((t) => b.includes(t));
  const needed = Math.min(2, Math.min(a.length, b.length));
  return overlap.length >= needed;
}
