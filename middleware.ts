import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  
  // If user is authenticated and trying to access auth pages, redirect to dashboard
  if (sessionCookie) {
    const { pathname } = request.nextUrl;
    
    if (pathname === "/login" || pathname === "/signup" || pathname === "/reset-password") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
  
  // If user is not authenticated and trying to access protected routes, redirect to login
  if (!sessionCookie) {
    const { pathname } = request.nextUrl;
    
    if (pathname === "/dashboard" || pathname === "/profiles") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/profiles",
    "/login", 
    "/signup", 
    "/reset-password"
  ],
};
