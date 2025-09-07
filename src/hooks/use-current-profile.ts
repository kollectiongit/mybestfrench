"use client";

import { useProfile } from "@/contexts/profile-context";

/**
 * Convenience hook for accessing current profile data
 * This is a lighter alternative to useProfile when you only need current profile info
 */
export function useCurrentProfile() {
  const { currentProfile, isLoading, error } = useProfile();
  
  return {
    profile: currentProfile,
    isLoading,
    error,
    hasProfile: !!currentProfile,
  };
}

/**
 * Hook for profile switching functionality
 */
export function useProfileSwitcher() {
  const { 
    currentProfile, 
    allProfiles, 
    setCurrentProfile, 
    isLoading,
    error 
  } = useProfile();
  
  return {
    currentProfile,
    allProfiles,
    switchProfile: setCurrentProfile,
    isLoading,
    error,
    hasProfiles: allProfiles.length > 0,
  };
}
