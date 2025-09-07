import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfileFromCookie } from "./lib/profile-cookies";

export async function middleware(request: NextRequest) {
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
      "/exercices",
      "/welcome"
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
    const response = NextResponse.next();
    
    // Add current profile ID to request headers so it's available in SSR
    if (currentProfileId) {
      response.headers.set('x-current-profile-id', currentProfileId);
    }
    
    return response;
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/profiles",
    "/exercices/:path*",
    "/welcome",
    "/login", 
    "/signup", 
    "/reset-password"
  ],
};
