"use client";

import { Check, CircleX, X } from "lucide-react";

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

export default function CategoryFilters({
  dictations,
  selectedTopics,
  setSelectedTopics,
}: {
  dictations: Dictation[];
  selectedTopics: number[];
  setSelectedTopics: (v: number[]) => void;
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
          : "bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-200"
      }`}
      onClick={onClick}
    >
      <span className="text-xs font-medium">{name}</span>
      <span
        className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
          isSelected
            ? "bg-blue-200 text-blue-700 group-hover:bg-blue-300 transition-all duration-200"
            : "bg-gray-50 text-gray-500"
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
    <>
      {/* Categories */}
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
              ...selectedTopics.filter((id) => !category.topicIds.includes(id)),
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

      {/* Clear filters button */}
      {selectedTopics.length > 0 && (
        <div
          className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer min-h-[32px] bg-gray-200 text-gray-700 hover:bg-gray-300"
          onClick={() => setSelectedTopics([])}
        >
          <X className="h-4 w-4" />
          <span className="text-xs font-medium">Effacer les filtres</span>
        </div>
      )}
    </>
  );
}
