import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Public Supabase client (anon key).
 * Used by: customer-facing website, admin SPA (React).
 * Access is limited by RLS policies.
 */
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

/**
 * Admin Supabase client (service role key).
 * Used by: server-side only (Astro SSR endpoints, migration scripts).
 * Bypasses RLS — NEVER expose to the browser.
 */
export function createAdminClient() {
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
