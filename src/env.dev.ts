/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user?: import('@supabase/supabase-js').User;
    token?: string;
    supabase?: import('@supabase/supabase-js').SupabaseClient;
  }
}