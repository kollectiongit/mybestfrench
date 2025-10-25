"use client";

import { CurrentProfile } from "@/lib/current-profile";
import {
  clearProfileCache,
  getCachedCurrentProfile,
  getCachedProfiles,
  setCachedCurrentProfile,
  setCachedProfiles,
  updateCachedCurrentProfile,
} from "@/lib/profile-cache";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";

interface ProfileContextType {
  currentProfile: CurrentProfile | null;
  allProfiles: CurrentProfile[];
  isLoading: boolean;
  error: string | null;
  setCurrentProfile: (
    profileId: string,
    showLoading?: boolean
  ) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  clearCurrentProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
  initialProfile?: CurrentProfile | null;
  initialProfiles?: CurrentProfile[];
  serverSideAuthChecked?: boolean;
}

export function ProfileProvider({
  children,
  initialProfile = null,
  initialProfiles = [],
  serverSideAuthChecked = false,
}: ProfileProviderProps) {
  // Initialize with cached data first, then fallback to initial data
  // But only use cached data on client-side to prevent hydration mismatches
  const [currentProfile, setCurrentProfileState] =
    useState<CurrentProfile | null>(() => {
      // Only use cached data on client-side
      if (typeof window !== "undefined") {
        return getCachedCurrentProfile() || initialProfile;
      }
      return initialProfile;
    });
  const [allProfiles, setAllProfiles] = useState<CurrentProfile[]>(() => {
    // Only use cached data on client-side
    if (typeof window !== "undefined") {
      return getCachedProfiles().length > 0
        ? getCachedProfiles()
        : initialProfiles;
    }
    return initialProfiles;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);

  // Fetch current profile on mount if not provided initially
  useEffect(() => {
    // Only attempt to fetch if we haven't tried yet and we're not currently loading
    if (!hasAttemptedFetch && !isLoading) {
      setHasAttemptedFetch(true);

      // If server-side auth was checked and we have empty data, don't fetch
      // This means the user is not authenticated
      if (
        serverSideAuthChecked &&
        !initialProfile &&
        initialProfiles.length === 0 &&
        (typeof window === "undefined" ||
          (!getCachedCurrentProfile() && getCachedProfiles().length === 0))
      ) {
        // User is not authenticated, no need to fetch
        return;
      }

      // If we have valid initial data from server-side, don't fetch
      if (
        serverSideAuthChecked &&
        (initialProfile || initialProfiles.length > 0)
      ) {
        // Server-side data is available, no need to fetch
        return;
      }

      // Only fetch if we don't have cached data or initial data
      // Check cached data only on client-side
      const hasCachedCurrentProfile =
        typeof window !== "undefined" ? getCachedCurrentProfile() : null;
      const hasCachedProfiles =
        typeof window !== "undefined" ? getCachedProfiles().length > 0 : false;

      if (!hasCachedCurrentProfile && !initialProfile) {
        fetchCurrentProfile();
      }
      if (!hasCachedProfiles && initialProfiles.length === 0) {
        fetchAllProfiles();
      }
    }
  }, [
    initialProfile,
    initialProfiles,
    isLoading,
    hasAttemptedFetch,
    serverSideAuthChecked,
  ]);

  // Sync with cached data after hydration (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Check if cached data is different from current state
      const cachedCurrentProfile = getCachedCurrentProfile();
      const cachedProfiles = getCachedProfiles();

      // Only update if we have server-side data but cached data is different
      // This prevents hydration mismatches by only updating when necessary
      if (serverSideAuthChecked && initialProfile && cachedCurrentProfile) {
        // If cached profile is different from server-side profile, update to cached
        if (cachedCurrentProfile.id !== initialProfile.id) {
          setCurrentProfileState(cachedCurrentProfile);
        }
      }

      if (
        serverSideAuthChecked &&
        initialProfiles.length > 0 &&
        cachedProfiles.length > 0
      ) {
        // If cached profiles are different from server-side profiles, update to cached
        if (
          JSON.stringify(cachedProfiles) !== JSON.stringify(initialProfiles)
        ) {
          setAllProfiles(cachedProfiles);
        }
      }
    }
  }, [serverSideAuthChecked, initialProfile, initialProfiles]); // Include dependencies

  const fetchCurrentProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/current-profile");

      if (response.ok) {
        const data = await response.json();
        setCurrentProfileState(data.currentProfile);
        // Cache the profile data
        setCachedCurrentProfile(data.currentProfile);
      } else if (response.status === 401) {
        // User not authenticated - this is expected, don't set error
        setCurrentProfileState(null);
        clearProfileCache();
      } else {
        setError("Failed to fetch current profile");
      }
    } catch (err) {
      setError("Network error while fetching current profile");
      console.error("Error fetching current profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAllProfiles = async () => {
    try {
      const response = await fetch("/api/profiles");

      if (response.ok) {
        const data = await response.json();
        // Handle both old format (array) and new format (object with profiles property)
        const profiles = Array.isArray(data) ? data : data.profiles;
        setAllProfiles(profiles);
        // Cache the profiles data
        setCachedProfiles(profiles);
      } else if (response.status === 401) {
        // User not authenticated - this is expected, don't log error
        setAllProfiles([]);
        clearProfileCache();
      } else {
        console.error("Failed to fetch profiles");
      }
    } catch (err) {
      console.error("Error fetching profiles:", err);
    }
  };

  const setCurrentProfile = async (
    profileId: string,
    showLoading: boolean = true
  ) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);

      const response = await fetch("/api/current-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ profileId }),
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentProfileState(data.currentProfile);

        // Update cache with new current profile
        setCachedCurrentProfile(data.currentProfile);
        // Also update the cache for the current profile selection
        updateCachedCurrentProfile(profileId);

        // Show toast notification with profile name
        if (data.currentProfile?.first_name) {
          toast.success(`${data.currentProfile.first_name}, à toi de jouer`);
        }

        // Reload the page to refresh data based on new profile
        window.location.reload();
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to set current profile");
      }
    } catch (err) {
      setError("Network error while setting current profile");
      console.error("Error setting current profile:", err);
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const refreshProfiles = async () => {
    await Promise.all([fetchCurrentProfile(), fetchAllProfiles()]);
  };

  const clearCurrentProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/current-profile", {
        method: "DELETE",
      });

      if (response.ok) {
        setCurrentProfileState(null);
        // Clear cache when clearing profile
        clearProfileCache();
      } else {
        setError("Failed to clear current profile");
      }
    } catch (err) {
      setError("Network error while clearing current profile");
      console.error("Error clearing current profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const value: ProfileContextType = {
    currentProfile,
    allProfiles,
    isLoading,
    error,
    setCurrentProfile,
    refreshProfiles,
    clearCurrentProfile,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextType {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}

// Hook to get current profile only (lighter version)
export function useCurrentProfile(): Pick<
  ProfileContextType,
  "currentProfile" | "isLoading" | "error"
> {
  const { currentProfile, isLoading, error } = useProfile();
  return { currentProfile, isLoading, error };
}
