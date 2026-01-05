"use client";

import { Input } from "@/components/ui/input";
import { useCallback, useEffect, useState } from "react";

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

export default function MaxWordsFilter({
  maxWords,
  setMaxWords,
}: {
  maxWords: number | null;
  setMaxWords: (v: number | null) => void;
}) {
  const [inputValue, setInputValue] = useState<string>(
    maxWords?.toString() || ""
  );

  // Synchronize inputValue with maxWords when maxWords changes externally (e.g., clear filters)
  useEffect(() => {
    setInputValue(maxWords?.toString() || "");
  }, [maxWords]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Only accept numeric values
      if (value === "") {
        setMaxWords(null);
        return;
      }

      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue > 0) {
        setMaxWords(numValue);
      } else if (value === "") {
        setMaxWords(null);
      }
    },
    [setMaxWords]
  );

  const handleBlur = useCallback(() => {
    // Validate on blur - if invalid, reset to empty
    if (
      inputValue !== "" &&
      (isNaN(parseInt(inputValue, 10)) || parseInt(inputValue, 10) <= 0)
    ) {
      setInputValue("");
      setMaxWords(null);
    }
  }, [inputValue, setMaxWords]);

  const isActive = maxWords !== null;

  return (
    <div
      className={`flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg border bg-white h-10 transition-all duration-200 ${
        isActive ? "border-gray-700 text-gray-700" : "border hover:bg-gray-50"
      }`}
    >
      <label
        htmlFor="max-words-input"
        className="text-xs font-medium whitespace-nowrap cursor-pointer"
      >
        Mots
      </label>
      <Input
        id="max-words-input"
        type="number"
        min="1"
        step="1"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        placeholder="Max"
        className="h-7 w-20 text-xs px-2 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent p-0"
      />
    </div>
  );
}
