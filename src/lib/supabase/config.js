export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
// Accepts the new publishable key (sb_publishable_…, Supabase's own snippet name) or the legacy anon key.
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Until keys are set the storefront reads src/data/* and /admin shows setup instructions.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
