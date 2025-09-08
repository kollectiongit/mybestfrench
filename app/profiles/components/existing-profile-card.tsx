import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CurrentProfile, ProfileLevel } from "@/lib/current-profile";
import { EditIcon, UserIcon } from "lucide-react";
import Image from "next/image";

function getPublicUrl(filename: string | null) {
  if (!filename) return null;
  return `/api/avatars/${filename}`;
}

export default function ExistingProfileCard({
  profile,
  isCurrent,
  onSelect,
  onEdit,
}: {
  profile: CurrentProfile;
  isCurrent: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <Card
      key={profile.id}
      className={`h-96 w-full max-w-80 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group relative overflow-hidden ml-4 sm:ml-6 lg:ml-8 ${
        isCurrent ? "ring-2 ring-green-500 ring-offset-0 border-0" : ""
      }`}
      onClick={onSelect}
    >
      <Button
        size="sm"
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0 z-10"
      >
        <EditIcon className="h-4 w-4" />
      </Button>

      <div className="absolute inset-0 rounded-lg -z-10 transition-all duration-500 ease-out blur-2xl opacity-30 bg-gradient-to-r from-indigo-500/50 to-purple-500/50" />

      <CardContent className="flex flex-col items-center justify-center h-full p-6 relative backdrop-blur-sm bg-card/40">
        <div className="w-20 h-20 mb-4 rounded-full p-1 border-2 border-white/20">
          {profile.avatar_url ? (
            <Image
              src={getPublicUrl(profile.avatar_url) || ""}
              alt={`${profile.first_name} ${profile.last_name || ""}`}
              width={80}
              height={80}
              className="w-full h-full rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
              <UserIcon className="h-6 w-6 text-gray-400" />
            </div>
          )}
        </div>

        <h2 className="text-xl font-bold text-card-foreground text-center mb-2">
          {profile.first_name} {profile.last_name || ""}
        </h2>

        {profile.age && (
          <p className="text-sm font-medium text-primary mb-3">
            {profile.age} ans
          </p>
        )}

        {profile.description && (
          <>
            <div className="w-1/2 h-px mb-3 rounded-full bg-border" />
            <p className="text-center text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {profile.description}
            </p>
          </>
        )}

        {profile.profile_levels && profile.profile_levels.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center mt-3">
            {profile.profile_levels.map((profileLevel: ProfileLevel) => (
              <Badge
                key={profileLevel.id}
                className="bg-teal-400 text-white border-teal-400 hover:bg-teal-500"
              >
                {profileLevel.levels.code}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
