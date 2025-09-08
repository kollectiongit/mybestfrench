"use client";

import { Button } from "@/components/ui/button";
import { Check, CircleX, X } from "lucide-react";

interface Level {
  id: number;
  code: string;
  label: string;
  rank: number;
}
interface DictationLevel {
  id: number;
  level_id: number;
  dictation_id: string;
  levels: Level;
}
interface Topic {
  id: number;
  name: string;
  slug: string;
  category: { id: number; name: string; slug: string };
}
export interface Dictation {
  id: string;
  topic_id: number;
  original_text: string | null;
  audio_file: string | null;
  screenshot_file: string | null;
  picture_file: string | null;
  count_words: number | null;
  created_at: string;
  updated_at: string;
  topic: Topic;
  dictations_levels: DictationLevel[];
}

export default function Filters({
  dictations,
  selectedTopics,
  setSelectedTopics,
}: {
  dictations: Dictation[];
  selectedTopics: number[];
  setSelectedTopics: (v: number[]) => void;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-3">
        {Array.from(new Set(dictations.map((d) => d.topic.id)))
          .map((topicId) => {
            const topic = dictations.find((d) => d.topic.id === topicId)?.topic;
            if (!topic) return null;

            const isSelected = selectedTopics.includes(topicId);
            const dictationCount = dictations.filter(
              (d) => d.topic.id === topicId
            ).length;

            return (
              <div
                key={topicId}
                className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer min-h-[32px] ${
                  isSelected
                    ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                    : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                }`}
                onClick={() => {
                  if (isSelected) {
                    setSelectedTopics(
                      selectedTopics.filter((id) => id !== topicId)
                    );
                  } else {
                    setSelectedTopics([...selectedTopics, topicId]);
                  }
                }}
              >
                <span className="text-xs font-medium">{topic.name}</span>
                <span
                  className={`text-xs font-light h-5 w-5 rounded-full text-center flex items-center justify-center ${
                    isSelected
                      ? "bg-blue-200 text-blue-700 group-hover:bg-blue-300 transition-all duration-200"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  {dictationCount}
                </span>
                {isSelected && (
                  <div className="flex items-center justify-center w-5 h-5">
                    <Check className="w-4 h-4 text-blue-600 group-hover:hidden" />
                    <CircleX className="w-4 h-4 text-blue-600 hidden group-hover:block" />
                  </div>
                )}
              </div>
            );
          })
          .filter(Boolean)}
        {selectedTopics.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTopics([])}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg min-h-[32px] text-sm"
          >
            <X className="h-4 w-4 mr-2" />
            Effacer les filtres
          </Button>
        )}
      </div>
    </div>
  );
}
