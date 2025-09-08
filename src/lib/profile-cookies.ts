import { NextRequest, NextResponse } from "next/server";

const CURRENT_PROFILE_COOKIE_NAME = "current_profile";
const COOKIE_MAX_AGE = 180 * 24 * 60 * 60; // 180 days in seconds

/**
 * Signs a value using HMAC-SHA256 with Web Crypto API
 */
async function signValue(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const signatureHex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return `${value}.${signatureHex}`;
}

/**
 * Verifies a signed value using Web Crypto API
 */
async function verifySignedValue(signedValue: string, secret: string): Promise<string | null> {
  const lastDotIndex = signedValue.lastIndexOf('.');
  if (lastDotIndex === -1) return null;
  
  const value = signedValue.slice(0, lastDotIndex);
  const signature = signedValue.slice(lastDotIndex + 1);
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const expectedSignature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  const expectedSignatureHex = Array.from(new Uint8Array(expectedSignature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Use constant-time comparison to prevent timing attacks
  if (signature === expectedSignatureHex) {
    return value;
  }
  
  return null;
}

/**
 * Sets the current profile cookie
 */
export async function setCurrentProfileCookie(response: NextResponse, profileId: string): Promise<void> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is required for signing cookies");
  }
  
  const signedProfileId = await signValue(profileId, secret);
  
  response.cookies.set(CURRENT_PROFILE_COOKIE_NAME, signedProfileId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  });
}

/**
 * Gets the current profile ID from cookies
 */
export async function getCurrentProfileFromCookie(request: NextRequest): Promise<string | null> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    console.warn("BETTER_AUTH_SECRET is required for verifying cookies");
    return null;
  }
  
  const signedProfileId = request.cookies.get(CURRENT_PROFILE_COOKIE_NAME)?.value;
  if (!signedProfileId) return null;
  
  return await verifySignedValue(signedProfileId, secret);
}

/**
 * Clears the current profile cookie
 */
export function clearCurrentProfileCookie(response: NextResponse): void {
  response.cookies.delete(CURRENT_PROFILE_COOKIE_NAME);
}

/**
 * Gets the current profile cookie name for client-side access (if needed)
 */
export function getCurrentProfileCookieName(): string {
  return CURRENT_PROFILE_COOKIE_NAME;
}
