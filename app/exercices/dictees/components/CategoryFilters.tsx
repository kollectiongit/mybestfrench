"use client";

import { Check, CircleX } from "lucide-react";

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
  ) => {
    // Check if this is the "Orthographe", "Grammaire", or "Conjugaison" category
    const isOrthographe = name === "Orthographe";
    const isGrammaire = name === "Grammaire";
    const isConjugaison = name === "Conjugaison";

    // Get colors based on category
    const getButtonClasses = () => {
      if (isSelected) {
        if (isOrthographe)
          return "bg-orange-300 text-orange-950 hover:bg-orange-400 hover:scale-105 transition-all duration-200";
        if (isGrammaire)
          return "bg-cyan-300 text-cyan-950 hover:bg-cyan-400 hover:scale-105 transition-all duration-200";
        if (isConjugaison)
          return "bg-fuchsia-300 text-fuchsia-950 hover:bg-fuchsia-400 hover:scale-105 transition-all duration-200";
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      } else {
        if (isOrthographe)
          return "border border-orange-300 bg-none text-orange-500 hover:border-orange-400 hover:text-orange-600 hover:scale-105 transition-all duration-200";
        if (isGrammaire)
          return "border border-cyan-300 bg-none text-cyan-500 hover:border-cyan-400 hover:text-cyan-600 hover:scale-105 transition-all duration-200";
        if (isConjugaison)
          return "border border-fuchsia-300 bg-none text-fuchsia-500 hover:border-fuchsia-400 hover:text-fuchsia-600 hover:scale-105 transition-all duration-200";
        return "bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-200";
      }
    };

    const getBadgeClasses = () => {
      if (isSelected) {
        if (isOrthographe)
          return "bg-orange-200 text-orange-800 transition-all duration-200";
        if (isGrammaire)
          return "bg-cyan-200 text-cyan-800 transition-all duration-200";
        if (isConjugaison)
          return "bg-fuchsia-200 text-fuchsia-800 transition-all duration-200";
        return "bg-blue-200 text-blue-700 group-hover:bg-blue-300 transition-all duration-200";
      } else {
        if (isOrthographe)
          return "bg-orange-100 text-orange-500 group-hover:bg-orange-200 group-hover:text-orange-600 transition-all duration-200";
        if (isGrammaire)
          return "bg-cyan-100 text-cyan-500 group-hover:bg-cyan-200 group-hover:text-cyan-600 transition-all duration-200";
        if (isConjugaison)
          return "bg-fuchsia-100 text-fuchsia-500 group-hover:bg-fuchsia-200 group-hover:text-fuchsia-600 transition-all duration-200";
        return "bg-gray-50 text-gray-500";
      }
    };

    const getIconColor = () => {
      if (isOrthographe) return "text-orange-950";
      if (isGrammaire) return "text-cyan-950";
      if (isConjugaison) return "text-fuchsia-950";
      return "text-blue-600";
    };

    return (
      <div
        key={id}
        className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-10 ${getButtonClasses()}`}
        onClick={onClick}
      >
        <span className="text-xs font-medium">{name}</span>
        <span
          className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${getBadgeClasses()}`}
        >
          {count}
        </span>
        {isSelected && (
          <div className="flex items-center justify-center w-5 h-5 relative cursor-pointer">
            <Check
              className={`w-4 h-4 ${getIconColor()} group-hover:hidden transition-all duration-200`}
            />
            <CircleX
              className={`w-4 h-4 ${getIconColor()} hidden group-hover:block group-hover:scale-110 transition-transform duration-200`}
            />
          </div>
        )}
      </div>
    );
  };

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
    </>
  );
}
