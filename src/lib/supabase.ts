import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

function setAccessTokenCookie(token?: string | null) {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `sb-access-token=${token}; path=/; max-age=3600; SameSite=Lax`;
  } else {
    document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
  }
}

if (typeof window !== 'undefined') {
  supabase.auth.getSession().then(({ data }) => {
    setAccessTokenCookie(data.session?.access_token);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    setAccessTokenCookie(session?.access_token);
  });
}