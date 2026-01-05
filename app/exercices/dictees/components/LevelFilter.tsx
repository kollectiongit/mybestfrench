"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

export interface Dictation {
  id: number;
  title: string;
  count_words: number | null;
  topic: {
    id: number;
    name: string;
    category: {
      name: string;
    };
  };
  levels: string[];
  audio_files: string[];
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: string | null;
  errors_range: string | null;
}

// Ordre des niveaux pour l'affichage
const LEVEL_ORDER = ["CE1", "CE2", "CM1", "CM2"] as const;

export default function LevelFilter({
  dictations,
  selectedLevels,
  setSelectedLevels,
  filteredDictations,
}: {
  dictations: Dictation[];
  selectedLevels: string[];
  setSelectedLevels: (v: string[]) => void;
  filteredDictations?: Dictation[];
}) {
  const [open, setOpen] = useState(false);
  // Use filtered dictations if provided, otherwise use all dictations
  const dictationsToCount = filteredDictations || dictations;

  // Count dictations for each level based on the filtered dictations
  const getCount = (level: string) => {
    return dictationsToCount.filter((d) => d.levels.includes(level)).length;
  };

  const toggleLevel = (level: string) => {
    if (selectedLevels.includes(level)) {
      setSelectedLevels(selectedLevels.filter((l) => l !== level));
    } else {
      setSelectedLevels([...selectedLevels, level]);
    }
  };

  const getDisplayLabel = () => {
    if (selectedLevels.length === 0) {
      return "Niveaux";
    }
    if (selectedLevels.length === LEVEL_ORDER.length) {
      return "Tous les niveaux";
    }
    if (selectedLevels.length === 1) {
      return selectedLevels[0];
    }
    return `${selectedLevels.length} niveaux`;
  };

  const getDisplayCount = () => {
    if (selectedLevels.length === 0) {
      return dictationsToCount.length;
    }
    // Count dictations that have at least one selected level (OR logic)
    return dictationsToCount.filter((d) =>
      d.levels.some((level) => selectedLevels.includes(level))
    ).length;
  };

  const isActive = selectedLevels.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg border bg-white cursor-pointer h-10 transition-all duration-200 ${
            isActive
              ? "border-gray-700 text-gray-700"
              : "border hover:bg-gray-50"
          }`}
          onClick={() => setOpen(true)}
        >
          <span className="text-xs font-medium">{getDisplayLabel()}</span>
          <ChevronDownIcon
            size={16}
            className="text-muted-foreground/80 shrink-0 opacity-50"
          />
          <span
            className={`h-6 w-6 rounded-full text-center flex items-center justify-center shrink-0 text-[10px] font-bold ${
              isActive
                ? "bg-gray-100 text-gray-600"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {getDisplayCount()}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        <div className="space-y-1">
          <div
            className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-gray-100 cursor-pointer"
            onClick={() => {
              if (selectedLevels.length === LEVEL_ORDER.length) {
                setSelectedLevels([]);
              } else {
                setSelectedLevels([...LEVEL_ORDER]);
              }
            }}
          >
            <Checkbox
              checked={
                selectedLevels.length === LEVEL_ORDER.length &&
                selectedLevels.length > 0
              }
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedLevels([...LEVEL_ORDER]);
                } else {
                  setSelectedLevels([]);
                }
              }}
            />
            <div className="flex items-center gap-2 w-full">
              <span className="text-sm">Tous les niveaux</span>
              <span className="ml-auto h-6 w-6 rounded-full bg-gray-700 text-white text-[10px] font-bold text-center flex items-center justify-center">
                {dictationsToCount.length}
              </span>
            </div>
          </div>
          {LEVEL_ORDER.map((level) => {
            const isSelected = selectedLevels.includes(level);
            const count = getCount(level);
            return (
              <div
                key={level}
                className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-gray-100 cursor-pointer"
                onClick={() => toggleLevel(level)}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleLevel(level)}
                />
                <div className="flex items-center gap-2 w-full">
                  <span className="text-sm">{level}</span>
                  <span className="ml-auto h-6 w-6 rounded-full bg-gray-700 text-white text-[10px] font-bold text-center flex items-center justify-center">
                    {count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
