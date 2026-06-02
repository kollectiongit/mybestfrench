import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import type { auth } from "@/lib/auth";
import { betterFetch } from "@better-fetch/fetch";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "./src/utils/spabase/middleware";

type Session = typeof auth.$Infer.Session;

export async function middleware(request: NextRequest) {
  const { response } = createClient(request);

  // Validate the actual session (DB-backed), not just the cookie's presence.
  // A stale/expired cookie must be treated as "not authenticated", otherwise
  // logged-out users get bounced away from /login and onto protected pages.
  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: { cookie: request.headers.get("cookie") || "" },
    }
  );

  const { pathname, search } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api");
  const isAuthPage = pathname === "/login" || pathname === "/signup" || pathname === "/reset-password";
  const isProfilesPage = pathname === "/profiles" || pathname.startsWith("/profiles/");
  const protectedRoutes = [
    "/", // homepage requires auth per plan
    "/exercices",
    "/dashboard",
    "/profiles", // protected but special-cased: no profile redirect here
  ];
  const isProtectedRoute = protectedRoutes.some((route) => pathname === route || pathname.startsWith(route + "/"));
  
  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (session) {
    if (isAuthPage) {
      return NextResponse.redirect(new URL("/profiles", request.url));
    }
  }

  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!session) {
    if (!isApiRoute && isProtectedRoute && !isAuthPage) {
      const nextParam = encodeURIComponent(pathname + (search || ""));
      return NextResponse.redirect(new URL(`/login?next=${nextParam}` as string, request.url));
    }
  }

  // For authenticated users, add current profile ID to headers for SSR access
  if (session) {
    const currentProfileId = await getCurrentProfileFromCookie(request);
    
    // Add current profile ID to request headers so it's available in SSR
    if (currentProfileId) {
      response.headers.set('x-current-profile-id', currentProfileId);
    } else {
      // If route requires a selected profile and none is present, redirect to /profiles
      if (!isApiRoute && isProtectedRoute && !isProfilesPage && !isAuthPage) {
        const url = new URL("/profiles", request.url);
        url.searchParams.set("message", "profile-required");
        return NextResponse.redirect(url);
      }
    }
    
    return response;
  }
  
  return response;
}

export const config = {
  matcher: [
    "/",
    "/profiles",
    "/profiles/:path*",
    "/exercices",
    "/exercices/:path*",
    "/login", 
    "/signup", 
    "/reset-password"
  ],
};
