/**
 * Client-side profile caching utilities — DISABLED.
 *
 * Previously this module cached profile data in localStorage with a 5-minute
 * TTL. That cache (combined with a similar cookie cache that stripped fields)
 * caused stale profile edits to keep showing up after page refresh. We now
 * always read profiles from the API. These functions are kept as no-ops so
 * existing call sites continue to compile.
 */

import { CurrentProfile } from "@/lib/current-profile";

const PROFILE_CACHE_KEY = "profile_cache";
const PROFILES_CACHE_KEY = "profiles_cache";
const CACHE_EXPIRY_KEY = "profile_cache_expiry";

function wipeLegacyLocalStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(PROFILES_CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
  } catch {
    // ignore
  }
}

export function getCachedCurrentProfile(): CurrentProfile | null {
  wipeLegacyLocalStorage();
  return null;
}

export function setCachedCurrentProfile(_profile: CurrentProfile | null): void {
  void _profile;
  wipeLegacyLocalStorage();
}

export function getCachedProfiles(): CurrentProfile[] {
  wipeLegacyLocalStorage();
  return [];
}

export function setCachedProfiles(_profiles: CurrentProfile[]): void {
  void _profiles;
  wipeLegacyLocalStorage();
}

export function clearProfileCache(): void {
  wipeLegacyLocalStorage();
}

export function hasCachedProfileData(): boolean {
  return false;
}

export function updateCachedCurrentProfile(_profileId: string): void {
  void _profileId;
  wipeLegacyLocalStorage();
}
