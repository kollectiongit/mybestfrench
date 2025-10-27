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
        className={`group relative inline-flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-10 border ${
          showAttemptedOnly
            ? "border-green-400 text-green-400 hover:border-green-500 hover:text-green-500"
            : "border bg-white hover:bg-gray-50"
        }`}
        onClick={() => setShowAttemptedOnly(!showAttemptedOnly)}
      >
        <ThumbsUp className="w-4 h-4" />
        <span className="text-xs font-medium">Déjà fait</span>
        <span
          className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
            showAttemptedOnly
              ? "bg-green-100 text-green-700 group-hover:bg-green-200 transition-all duration-200"
              : "bg-gray-100 text-gray-600 "
          }`}
        >
          {attemptedCount}
        </span>
        {showAttemptedOnly && (
          <div className="flex items-center justify-center w-5 h-5">
            <Check className="w-4 h-4 text-green-400 group-hover:hidden" />
            <CircleX className="w-4 h-4 text-green-400 hidden group-hover:block" />
          </div>
        )}
      </div>

      <div
        className={`group relative inline-flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-10 border ${
          showNotAttemptedOnly
            ? "border-red-400 text-red-400 hover:border-red-500 hover:text-red-500"
            : "border bg-white hover:bg-gray-50"
        }`}
        onClick={() => setShowNotAttemptedOnly(!showNotAttemptedOnly)}
      >
        <ThumbsDown className="w-4 h-4" />
        <span className="text-xs font-medium">Jamais fait</span>
        <span
          className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
            showNotAttemptedOnly
              ? "bg-red-100 text-red-700 group-hover:bg-red-200 transition-all duration-200"
              : "bg-gray-100 text-gray-600 "
          }`}
        >
          {notAttemptedCount}
        </span>
        {showNotAttemptedOnly && (
          <div className="flex items-center justify-center w-5 h-5">
            <Check className="w-4 h-4 text-red-400 group-hover:hidden" />
            <CircleX className="w-4 h-4 text-red-400 hidden group-hover:block" />
          </div>
        )}
      </div>
    </>
  );
}
