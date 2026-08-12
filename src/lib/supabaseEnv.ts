// Build-time Supabase config with hard fallbacks.
// Native (Capacitor) release builds must never end up with `undefined` URLs,
// so we fall back to the project constants when VITE_* env vars are absent.
export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://rsqefyykvxwmbwdnzvtb.supabase.co";

export const SUPABASE_PROJECT_ID =
  (import.meta.env.VITE_SUPABASE_PROJECT_ID as string) || "rsqefyykvxwmbwdnzvtb";

export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzcWVmeXlrdnh3bWJ3ZG56dnRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3Nzc0MTcsImV4cCI6MjEwMTM1MzQxN30.4bVkaNKc0zYz0uBKysBxOFLhPohK2ng8io5v2jhHCqU";
