import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      document.cookie = `sb-access-token=${session.access_token}; path=/; max-age=3600; SameSite=Lax`;
    } else {
      document.cookie = 'sb-access-token=; path=/; max-age=0; SameSite=Lax';
    }
  });
}