import { Checkbox } from "@/components/ui/checkbox";
import { useEffect, useId, useState } from "react";

interface Level {
  id: number;
  code: string;
  label: string;
  rank: number;
}

interface ProfileLevel {
  id: number;
  profile_id: string;
  level_id: number;
  levels: Level;
}

interface ProfileLevelsSelectorProps {
  profileId?: string;
  onLevelsChange?: (selectedLevelIds: number[]) => void;
}

export default function ProfileLevelsSelector({
  profileId,
  onLevelsChange,
}: ProfileLevelsSelectorProps) {
  const id = useId();
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevelIds, setSelectedLevelIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all available levels
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch("/api/levels");
        if (!response.ok) {
          throw new Error("Failed to fetch levels");
        }
        const data = await response.json();
        setLevels(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch levels");
      }
    };

    fetchLevels();
  }, []);

  // Fetch current profile levels (only if profileId is provided)
  useEffect(() => {
    if (!profileId) {
      setIsLoading(false);
      return;
    }

    const fetchProfileLevels = async () => {
      try {
        const response = await fetch(`/api/profiles/${profileId}/levels`);
        if (!response.ok) {
          throw new Error("Failed to fetch profile levels");
        }
        const data: ProfileLevel[] = await response.json();
        const levelIds = data.map((pl) => pl.level_id);
        setSelectedLevelIds(levelIds);
        onLevelsChange?.(levelIds);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch profile levels"
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfileLevels();
  }, [profileId, onLevelsChange]);

  const handleLevelToggle = (levelId: number) => {
    const newSelectedIds = selectedLevelIds.includes(levelId)
      ? selectedLevelIds.filter((id) => id !== levelId)
      : [...selectedLevelIds, levelId];

    setSelectedLevelIds(newSelectedIds);
    onLevelsChange?.(newSelectedIds);
  };

  if (isLoading) {
    return (
      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm leading-none font-medium">
          Levels
        </legend>
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="border-input relative flex size-9 flex-col items-center justify-center gap-3 rounded-full border bg-muted animate-pulse"
            />
          ))}
        </div>
      </fieldset>
    );
  }

  if (error) {
    return (
      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm leading-none font-medium">
          Levels
        </legend>
        <div className="text-sm text-destructive">Error: {error}</div>
      </fieldset>
    );
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-foreground text-sm leading-none font-medium">
        Levels
      </legend>
      <div className="flex gap-1.5 flex-wrap">
        {levels.map((level) => (
          <label
            key={`${id}-${level.id}`}
            className={`border-input has-focus-visible:border-ring has-focus-visible:ring-ring/50 relative flex min-w-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-full border text-center shadow-xs transition-[color,box-shadow] outline-none has-focus-visible:ring-[3px] has-data-disabled:cursor-not-allowed has-data-disabled:opacity-50 px-2 py-1 ${
              selectedLevelIds.includes(level.id)
                ? "border-teal-400 bg-teal-400 text-white"
                : "border-input bg-background text-foreground"
            }`}
          >
            <Checkbox
              id={`${id}-${level.id}`}
              value={level.id.toString()}
              className="sr-only after:absolute after:inset-0"
              checked={selectedLevelIds.includes(level.id)}
              onCheckedChange={() => handleLevelToggle(level.id)}
            />
            <span aria-hidden="true" className="text-xs font-medium">
              {level.code}
            </span>
            <span className="sr-only">{level.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
