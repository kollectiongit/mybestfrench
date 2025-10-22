import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Determine which key to use based on environment
const isProduction = process.env.NODE_ENV === "production";

let supabaseKey: string;

if (isProduction) {
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!;
  if (!supabaseKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY is not defined in production");
  }
} else {
  // For local development, use anon key since new keys aren't available yet
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined in local development");
  }
}

export const createClient = () =>
  createBrowserClient(
    supabaseUrl!,
    supabaseKey!,
  );
