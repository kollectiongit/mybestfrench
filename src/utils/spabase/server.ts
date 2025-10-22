import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Determine which key to use based on environment
const isProduction = process.env.NODE_ENV === "production";

let supabaseKey: string;

if (isProduction) {
  // For production, use the secret key for server-side operations
  supabaseKey = process.env.SUPABASE_SECRET_KEY!;
  if (!supabaseKey) {
    throw new Error("SUPABASE_SECRET_KEY is not defined in production");
  }
} else {
  // For local development, use service role key for server-side operations
  supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY!;
  if (!supabaseKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_SERVICE_KEY is not defined in local development");
  }
}

export const createClient = async (cookieStore: Awaited<ReturnType<typeof cookies>>) => {
  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};
