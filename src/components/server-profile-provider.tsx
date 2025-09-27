import { ProfileProvider } from "@/contexts/profile-context";
import { ReactNode } from "react";

interface ServerProfileProviderProps {
  children: ReactNode;
}

// Client-side only provider to avoid dynamic server usage
export function ServerProfileProvider({
  children,
}: ServerProfileProviderProps) {
  // Don't fetch server-side data here to avoid dynamic server usage
  // The ProfileProvider will handle client-side authentication
  return (
    <ProfileProvider
      initialProfile={null}
      initialProfiles={[]}
      serverSideAuthChecked={false}
    >
      {children}
    </ProfileProvider>
  );
}
