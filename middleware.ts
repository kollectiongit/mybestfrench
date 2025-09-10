import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfileFromCookie } from "./src/lib/profile-cookies";
import { createClient } from "./src/utils/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { response } = createClient(request);
  const sessionCookie = getSessionCookie(request);
  
  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (sessionCookie) {
    const { pathname } = request.nextUrl;
    
    if (pathname === "/login" || pathname === "/signup" || pathname === "/reset-password") {
      return NextResponse.redirect(new URL("/profiles", request.url));
    }
  }
  
  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!sessionCookie) {
    const { pathname } = request.nextUrl;
    
    // Define protected routes
    const protectedRoutes = [
      "/dashboard",
      "/profiles", 
      "/exercices"
    ];
    
    // Check if the current path starts with any protected route
    const isProtectedRoute = protectedRoutes.some(route => 
      pathname === route || pathname.startsWith(route + "/")
    );
    
    if (isProtectedRoute) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }
  
  // For authenticated users, add current profile ID to headers for SSR access
  if (sessionCookie) {
    const currentProfileId = await getCurrentProfileFromCookie(request);
    
    // Add current profile ID to request headers so it's available in SSR
    if (currentProfileId) {
      response.headers.set('x-current-profile-id', currentProfileId);
    }
    
    return response;
  }
  
  return response;
}

export const config = {
  matcher: [
    "/profiles",
    "/exercices",
    "/exercices/:path*",
    "/login", 
    "/signup", 
    "/reset-password"
  ],
};
