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

export default function TopicFilters({
  dictations,
  selectedTopics,
  setSelectedTopics,
}: {
  dictations: Dictation[];
  selectedTopics: number[];
  setSelectedTopics: (v: number[]) => void;
}) {
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

  const renderFilterButton = (
    id: string,
    name: string,
    count: number,
    isSelected: boolean,
    onClick: () => void
  ) => (
    <div
      key={id}
      className={`group relative gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer min-h-[32px] w-fit ${
        isSelected
          ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
          : "bg-gray-50 text-gray-700 hover:bg-gray-100"
      }`}
      onClick={onClick}
    >
      <span className="text-xs font-medium w-fit">{name}</span>
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
    <div className="flex flex-wrap gap-3">
      {/* Topics */}
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
  );
}
