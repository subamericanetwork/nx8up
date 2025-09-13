// src/lib/siteUrl.ts
export function getSiteUrl(): string {
  // Prefer explicit Vercel env, else fall back to the current origin (dev/preview).
  const fromEnv = (import.meta as any).env?.VITE_SITE_URL?.trim();
  const origin =
    (typeof window !== 'undefined' && window.location?.origin) || '';
  const base = (fromEnv || origin).replace(/\/+$/, ''); // strip trailing slash
  return base;
}
