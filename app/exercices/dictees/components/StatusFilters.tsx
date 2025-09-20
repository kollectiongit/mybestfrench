"use client";

import { Check, CircleX, ThumbsDown, ThumbsUp } from "lucide-react";

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

export default function StatusFilters({
  dictations,
  showAttemptedOnly,
  setShowAttemptedOnly,
  showNotAttemptedOnly,
  setShowNotAttemptedOnly,
}: {
  dictations: Dictation[];
  showAttemptedOnly: boolean;
  setShowAttemptedOnly: (v: boolean) => void;
  showNotAttemptedOnly: boolean;
  setShowNotAttemptedOnly: (v: boolean) => void;
}) {
  // Count attempted dictations
  const attemptedCount = dictations.filter((d) => d.attempts_count > 0).length;
  // Count not attempted dictations
  const notAttemptedCount = dictations.filter(
    (d) => d.attempts_count === 0
  ).length;

  return (
    <>
      <div
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer min-h-[32px] ${
          showAttemptedOnly
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-gray-50 text-gray-700 hover:bg-gray-100"
        }`}
        onClick={() => setShowAttemptedOnly(!showAttemptedOnly)}
      >
        <ThumbsUp className="w-4 h-4" />
        <span className="text-xs font-medium">Dictée déjà faite</span>
        <span
          className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
            showAttemptedOnly
              ? "bg-green-200 text-green-700 group-hover:bg-green-300 transition-all duration-200"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {attemptedCount}
        </span>
        {showAttemptedOnly && (
          <div className="flex items-center justify-center w-5 h-5">
            <Check className="w-4 h-4 text-green-600 group-hover:hidden" />
            <CircleX className="w-4 h-4 text-green-600 hidden group-hover:block" />
          </div>
        )}
      </div>

      <div
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer min-h-[32px] ${
          showNotAttemptedOnly
            ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
            : "bg-gray-50 text-gray-700 hover:bg-gray-100"
        }`}
        onClick={() => setShowNotAttemptedOnly(!showNotAttemptedOnly)}
      >
        <ThumbsDown className="w-4 h-4" />
        <span className="text-xs font-medium">Dictée jamais faite</span>
        <span
          className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
            showNotAttemptedOnly
              ? "bg-orange-200 text-orange-700 group-hover:bg-orange-300 transition-all duration-200"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {notAttemptedCount}
        </span>
        {showNotAttemptedOnly && (
          <div className="flex items-center justify-center w-5 h-5">
            <Check className="w-4 h-4 text-orange-600 group-hover:hidden" />
            <CircleX className="w-4 h-4 text-orange-600 hidden group-hover:block" />
          </div>
        )}
      </div>
    </>
  );
}
