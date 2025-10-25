import { ProfileProvider } from "@/contexts/profile-context";
import { CurrentProfile } from "@/lib/current-profile";
import { ReactNode } from "react";

interface ServerProfileProviderProps {
  children: ReactNode;
  initialProfile?: CurrentProfile | null;
  initialProfiles?: CurrentProfile[];
  session?: unknown;
}

// Client-side only provider to avoid dynamic server usage
export function ServerProfileProvider({
  children,
  initialProfile = null,
  initialProfiles = [],
}: ServerProfileProviderProps) {
  // Pass server-side data to ProfileProvider
  return (
    <ProfileProvider
      initialProfile={initialProfile}
      initialProfiles={initialProfiles}
      serverSideAuthChecked={true}
    >
      {children}
    </ProfileProvider>
  );
}
