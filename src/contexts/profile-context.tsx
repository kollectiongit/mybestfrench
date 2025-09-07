"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { toast } from "sonner";
import { CurrentProfile } from "../../lib/current-profile";

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
  const [currentProfile, setCurrentProfileState] =
    useState<CurrentProfile | null>(initialProfile);
  const [allProfiles, setAllProfiles] =
    useState<CurrentProfile[]>(initialProfiles);
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
        initialProfiles.length === 0
      ) {
        // User is not authenticated, no need to fetch
        return;
      }

      // Only fetch if we don't have initial data
      if (!initialProfile) {
        fetchCurrentProfile();
      }
      if (initialProfiles.length === 0) {
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

  const fetchCurrentProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/current-profile");

      if (response.ok) {
        const data = await response.json();
        setCurrentProfileState(data.currentProfile);
      } else if (response.status === 401) {
        // User not authenticated - this is expected, don't set error
        setCurrentProfileState(null);
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
        const profiles = await response.json();
        setAllProfiles(profiles);
      } else if (response.status === 401) {
        // User not authenticated - this is expected, don't log error
        setAllProfiles([]);
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

        // Show toast notification with profile name
        if (data.currentProfile?.first_name) {
          toast.success(`${data.currentProfile.first_name}, à toi de jouer`);
        }
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
