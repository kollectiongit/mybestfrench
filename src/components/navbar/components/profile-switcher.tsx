"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/contexts/profile-context";
import { authClient } from "@/lib/auth-client";
import {
  Check,
  ChevronDown,
  LogOutIcon,
  Settings,
  User,
  UserRoundPen,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function ProfileSwitcher() {
  const { data: session } = authClient.useSession();
  const {
    currentProfile,
    allProfiles,
    setCurrentProfile,
    isLoading,
    clearCurrentProfile,
  } = useProfile();

  const handleSignOut = async () => {
    await clearCurrentProfile(); // Clear profile before signing out
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/";
        },
      },
    });
  };

  // Generate public URL from filename
  const getPublicUrl = (filename: string | null) => {
    if (!filename) return null;
    return `/api/avatars/${filename}`;
  };

  // Always render the switcher when user is logged in, even without profiles

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-2 gap-2 hover:bg-gray-200"
          disabled={isLoading}
        >
          <Avatar className="h-8 w-8">
            {currentProfile?.avatar_url ? (
              <Image
                src={getPublicUrl(currentProfile.avatar_url) || ""}
                alt={`${currentProfile.first_name} ${currentProfile.last_name || ""}`}
                width={32}
                height={32}
                className="rounded-full object-cover"
              />
            ) : (
              <AvatarFallback className="bg-gray-200">
                <User size={14} />
              </AvatarFallback>
            )}
          </Avatar>
          {(() => {
            const displayName =
              currentProfile?.first_name || session?.user?.name;
            return displayName ? (
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium truncate max-w-24">
                  {displayName}
                </span>
                <ChevronDown size={14} className="opacity-60" />
              </div>
            ) : null;
          })()}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        <DropdownMenuLabel className="flex min-w-0 flex-col">
          <span className="text-foreground truncate text-sm font-medium">
            {session?.user?.name || "User"}
          </span>
          <span className="text-muted-foreground truncate text-xs font-normal">
            {session?.user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {allProfiles.map(
            (profile: {
              id: string;
              first_name: string;
              last_name: string | null;
              avatar_url: string | null;
              age: number | null;
              description: string | null;
              created_at: string | null;
              updated_at: string | null;
              profile_levels?: Array<{
                id: number;
                profile_id: string;
                level_id: number;
                levels: {
                  id: number;
                  code: string;
                  label: string;
                  rank: number;
                };
              }>;
            }) => (
              <DropdownMenuItem
                key={profile.id}
                className="cursor-pointer"
                onClick={() => setCurrentProfile(profile.id, false)}
              >
                <div className="flex items-center gap-3 w-full">
                  <Avatar className="h-8 w-8">
                    {profile.avatar_url ? (
                      <Image
                        src={getPublicUrl(profile.avatar_url) || ""}
                        alt={`${profile.first_name} ${profile.last_name || ""}`}
                        width={32}
                        height={32}
                        className="rounded-full object-cover"
                      />
                    ) : (
                      <AvatarFallback className="bg-gray-200">
                        <User size={14} />
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {profile.first_name} {profile.last_name || ""}
                      </span>
                      {currentProfile?.id === profile.id && (
                        <Check size={14} className="text-green-600" />
                      )}
                    </div>
                  </div>
                </div>
              </DropdownMenuItem>
            )
          )}
        </DropdownMenuGroup>
        {allProfiles.length > 0 && <DropdownMenuSeparator />}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/profiles" className="flex items-center gap-2">
              <UserRoundPen size={16} className="opacity-60" />
              <span>Gérer les profils</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings size={16} className="opacity-60" aria-hidden="true" />
            <span>Mon compte</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOutIcon size={16} className="opacity-60" aria-hidden="true" />
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
