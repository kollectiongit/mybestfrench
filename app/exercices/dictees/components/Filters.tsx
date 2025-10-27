"use client";

import { Button } from "@/components/ui/button";
import { Check, CircleX, ThumbsDown, ThumbsUp, X } from "lucide-react";

interface Topic {
  id: number;
  name: string;
  category: {
    name: string;
  };
}

export interface Dictation {
  id: number;
  title: string;
  count_words: number | null;
  topic: Topic;
  levels: string[];
  audio_files: string[];
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: string | null;
  errors_range: string | null;
}

export default function Filters({
  dictations,
  selectedTopics,
  setSelectedTopics,
  showAttemptedOnly,
  setShowAttemptedOnly,
  showNotAttemptedOnly,
  setShowNotAttemptedOnly,
}: {
  dictations: Dictation[];
  selectedTopics: number[];
  setSelectedTopics: (v: number[]) => void;
  showAttemptedOnly: boolean;
  setShowAttemptedOnly: (v: boolean) => void;
  showNotAttemptedOnly: boolean;
  setShowNotAttemptedOnly: (v: boolean) => void;
}) {
  // Create unique categories
  const categories = Array.from(
    new Set(dictations.map((d) => d.topic.category.name))
  ).map((categoryName) => {
    const categoryDictations = dictations.filter(
      (d) => d.topic.category.name === categoryName
    );
    return {
      name: categoryName,
      count: categoryDictations.length,
      topicIds: categoryDictations.map((d) => d.topic.id),
    };
  });

  // Create unique topics
  const topics = Array.from(new Set(dictations.map((d) => d.topic.id)))
    .map((topicId) => {
      const topic = dictations.find((d) => d.topic.id === topicId)?.topic;
      if (!topic) return null;
      const topicDictations = dictations.filter((d) => d.topic.id === topicId);
      return {
        id: topicId,
        name: topic.name,
        count: topicDictations.length,
      };
    })
    .filter((topic): topic is NonNullable<typeof topic> => topic !== null);

  // Count attempted dictations
  const attemptedCount = dictations.filter((d) => d.attempts_count > 0).length;
  // Count not attempted dictations
  const notAttemptedCount = dictations.filter(
    (d) => d.attempts_count === 0
  ).length;

  const renderFilterButton = (
    id: string,
    name: string,
    count: number,
    isSelected: boolean,
    onClick: () => void
  ) => (
    <div
      key={id}
      className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer min-h-[32px] ${
        isSelected
          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
          : "bg-gray-200 text-gray-700 hover:bg-gray-100"
      }`}
      onClick={onClick}
    >
      <span className="text-xs font-medium">{name}</span>
      <span
        className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
          isSelected
            ? "bg-blue-200 text-blue-700 group-hover:bg-blue-300 transition-all duration-200"
            : "bg-gray-200 text-gray-600"
        }`}
      >
        {count}
      </span>
      {isSelected && (
        <div className="flex items-center justify-center w-5 h-5">
          <Check className="w-4 h-4 text-blue-600 group-hover:hidden" />
          <CircleX className="w-4 h-4 text-blue-600 hidden group-hover:block" />
        </div>
      )}
    </div>
  );

  return (
    <div className="mb-6 space-y-3">
      {/* Row 0: Attempted filters - Updated bg colors */}
      <div className="flex flex-wrap gap-3">
        <div
          className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-8 ${
            showAttemptedOnly
              ? "bg-green-100 text-green-800 hover:bg-green-200"
              : "bg-white text-gray-600 "
          }`}
          onClick={() => setShowAttemptedOnly(!showAttemptedOnly)}
        >
          <ThumbsUp className="w-4 h-4" />
          <span className="text-xs font-medium">Déjà fait</span>
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
          className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-8 ${
            showNotAttemptedOnly
              ? "bg-orange-100 text-orange-800 hover:bg-orange-200"
              : "bg-white text-gray-600 "
          }`}
          onClick={() => setShowNotAttemptedOnly(!showNotAttemptedOnly)}
        >
          <ThumbsDown className="w-4 h-4" />
          <span className="text-xs font-medium">Jamais fait</span>
          <span
            className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
              showNotAttemptedOnly
                ? "bg-orange-200 text-orange-700 group-hover:bg-orange-300 transition-all duration-200"
                : "bg-white text-gray-600 "
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
      </div>

      {/* Row 1: Categories */}
      <div className="flex flex-wrap gap-3">
        {categories.map((category) => {
          const isSelected = category.topicIds.some((id) =>
            selectedTopics.includes(id)
          );
          const onClick = () => {
            if (isSelected) {
              // Remove all topics from this category
              setSelectedTopics(
                selectedTopics.filter((id) => !category.topicIds.includes(id))
              );
            } else {
              // Add all topics from this category
              setSelectedTopics([
                ...selectedTopics.filter(
                  (id) => !category.topicIds.includes(id)
                ),
                ...category.topicIds,
              ]);
            }
          };
          return renderFilterButton(
            `category-${category.name}`,
            category.name,
            category.count,
            isSelected,
            onClick
          );
        })}
      </div>

      {/* Row 2: Topics */}
      <div className="flex flex-wrap gap-3">
        {topics.map((topic) => {
          const isSelected = selectedTopics.includes(topic.id);
          const onClick = () => {
            if (isSelected) {
              setSelectedTopics(selectedTopics.filter((id) => id !== topic.id));
            } else {
              setSelectedTopics([...selectedTopics, topic.id]);
            }
          };
          return renderFilterButton(
            `topic-${topic.id}`,
            topic.name,
            topic.count,
            isSelected,
            onClick
          );
        })}
      </div>

      {/* Clear filters button */}
      {selectedTopics.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTopics([])}
            className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-3 py-1.5 rounded-lg min-h-[32px] text-sm"
          >
            <X className="h-4 w-4 mr-2" />
            Effacer les filtres
          </Button>
        </div>
      )}
    </div>
  );
}
