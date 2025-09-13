// src/lib/oauth.ts
import { getSiteUrl } from './siteUrl';
import { createClient } from '@supabase/supabase-js';

// If you already have a shared Supabase client, import that instead.
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export async function signInWithGoogle() {
  const base = getSiteUrl();
  const redirectTo = `${base}/oauth/callback`; // must be whitelisted in Supabase Auth

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      // If you need YouTube scope + refresh tokens, uncomment:
      // queryParams: { access_type: 'offline', prompt: 'consent' },
      // scopes: 'openid email profile https://www.googleapis.com/auth/youtube.readonly',
    },
  });

  if (error) throw error;
  return data;
}
