/**
 * Client-side profile caching utilities
 * This provides a cache-first strategy to minimize API calls
 */

import { CurrentProfile } from "@/lib/current-profile";

const PROFILE_CACHE_KEY = "profile_cache";
const PROFILES_CACHE_KEY = "profiles_cache";
const CACHE_EXPIRY_KEY = "profile_cache_expiry";
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

interface CacheData {
  data: CurrentProfile | CurrentProfile[] | null;
  timestamp: number;
}

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  try {
    const expiry = localStorage.getItem(CACHE_EXPIRY_KEY);
    if (!expiry) return false;
    
    const expiryTime = parseInt(expiry);
    return Date.now() < expiryTime;
  } catch {
    return false;
  }
}

/**
 * Set cache expiry timestamp
 */
function setCacheExpiry(): void {
  try {
    const expiry = Date.now() + CACHE_DURATION;
    localStorage.setItem(CACHE_EXPIRY_KEY, expiry.toString());
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get current profile from cache
 */
export function getCachedCurrentProfile(): CurrentProfile | null {
  if (!isCacheValid()) return null;
  
  try {
    const cached = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!cached) return null;
    
    const { data }: CacheData = JSON.parse(cached);
    return data as CurrentProfile;
  } catch {
    return null;
  }
}

/**
 * Cache current profile data
 */
export function setCachedCurrentProfile(profile: CurrentProfile | null): void {
  try {
    const cacheData: CacheData = {
      data: profile,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(cacheData));
    setCacheExpiry();
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Get all profiles from cache
 */
export function getCachedProfiles(): CurrentProfile[] {
  if (!isCacheValid()) return [];
  
  try {
    const cached = localStorage.getItem(PROFILES_CACHE_KEY);
    if (!cached) return [];
    
    const { data }: CacheData = JSON.parse(cached);
    return (data as CurrentProfile[]) || [];
  } catch {
    return [];
  }
}

/**
 * Cache all profiles data
 */
export function setCachedProfiles(profiles: CurrentProfile[]): void {
  try {
    const cacheData: CacheData = {
      data: profiles,
      timestamp: Date.now(),
    };
    
    localStorage.setItem(PROFILES_CACHE_KEY, JSON.stringify(cacheData));
    setCacheExpiry();
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Clear all profile cache
 */
export function clearProfileCache(): void {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
    localStorage.removeItem(PROFILES_CACHE_KEY);
    localStorage.removeItem(CACHE_EXPIRY_KEY);
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Check if we have any cached profile data
 */
export function hasCachedProfileData(): boolean {
  return getCachedCurrentProfile() !== null || getCachedProfiles().length > 0;
}

/**
 * Update cached current profile when switching profiles
 */
export function updateCachedCurrentProfile(profileId: string): void {
  try {
    const profiles = getCachedProfiles();
    const newCurrentProfile = profiles.find(p => p.id === profileId) || null;
    setCachedCurrentProfile(newCurrentProfile);
  } catch {
    // Ignore errors
  }
}
