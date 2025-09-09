import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client for server-side operations
 * Uses different keys based on environment:
 * - Production: SUPABASE_SECRET_KEY + NEXT_PUBLIC_SUPABASE_URL
 * - Local: NEXT_PUBLIC_SUPABASE_SERVICE_KEY + NEXT_PUBLIC_SUPABASE_URL
 */
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not defined");
  }

  // Determine which key to use based on environment
  const isProduction = process.env.NODE_ENV === "production";
  
  let supabaseKey: string;
  
  if (isProduction) {
    supabaseKey = process.env.SUPABASE_SECRET_KEY!;
    if (!supabaseKey) {
      throw new Error("SUPABASE_SECRET_KEY is not defined in production");
    }
  } else {
    supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!;
    if (!supabaseKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_SERVICE_KEY is not defined in local development");
    }
  }

  return createClient(supabaseUrl, supabaseKey);
}
