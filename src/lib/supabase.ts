import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Només la URL i la clau PÚBLICA «anon». La clau service_role no s'ha de posar mai al frontend:
// la seguretat real la donen les polítiques RLS de la base de dades.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;
