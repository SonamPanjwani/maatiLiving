export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Until keys are set the storefront reads src/data/* and /admin shows setup instructions.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
