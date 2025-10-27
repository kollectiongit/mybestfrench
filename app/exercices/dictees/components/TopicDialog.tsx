"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, CircleX, MoveDiagonal } from "lucide-react";
import { useState } from "react";

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

export default function TopicDialog({
  dictations,
  selectedTopics,
  setSelectedTopics,
}: {
  dictations: Dictation[];
  selectedTopics: number[];
  setSelectedTopics: (v: number[]) => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  // Create unique topics
  const allTopics = Array.from(new Set(dictations.map((d) => d.topic.id)))
    .map((topicId) => {
      const topic = dictations.find((d) => d.topic.id === topicId)?.topic;
      if (!topic) return null;
      const topicDictations = dictations.filter((d) => d.topic.id === topicId);
      return {
        id: topicId,
        name: topic.name,
        category: topic.category.name,
        count: topicDictations.length,
      };
    })
    .filter((topic): topic is NonNullable<typeof topic> => topic !== null);

  // Create unique categories
  const categories = Array.from(
    new Set(dictations.map((d) => d.topic.category.name))
  ).map((categoryName) => {
    const categoryTopics = allTopics.filter(
      (topic) => topic.category === categoryName
    );
    return {
      name: categoryName,
      count: categoryTopics.length,
    };
  });

  // Filter topics based on search term and selected category
  const filteredTopics = allTopics.filter((topic) => {
    const matchesSearch =
      topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      topic.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "" || topic.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleTopicToggle = (topicId: number) => {
    if (selectedTopics.includes(topicId)) {
      setSelectedTopics(selectedTopics.filter((id) => id !== topicId));
    } else {
      setSelectedTopics([...selectedTopics, topicId]);
    }
  };

  const renderTopicChip = (topic: (typeof allTopics)[0]) => {
    const isSelected = selectedTopics.includes(topic.id);
    return (
      <div
        key={topic.id}
        className={`group relative inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer min-h-[36px] ${
          isSelected
            ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
            : "bg-gray-50 text-gray-700 hover:bg-gray-100"
        }`}
        onClick={() => handleTopicToggle(topic.id)}
      >
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium">{topic.name}</span>
          <span className="text-xs text-gray-500">{topic.category}</span>
        </div>
        <span
          className={`text-[10px] font-bold h-6 w-6 rounded-full text-center flex items-center justify-center ${
            isSelected
              ? "bg-blue-200 text-blue-700 group-hover:bg-blue-300 transition-all duration-200"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {topic.count}
        </span>
        {isSelected && (
          <div className="flex items-center justify-center w-5 h-5">
            <Check className="w-4 h-4 text-blue-600 group-hover:hidden" />
            <CircleX className="w-4 h-4 text-blue-600 hidden group-hover:block" />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 px-2 md:px-3 bg-primary text-white">
          <MoveDiagonal className="w-4 h-4 text-white" />
          <span className="text-xs font-bold">Thèmes</span>
          {selectedTopics.length > 0 && (
            <span className="ml-2 h-6 w-6 rounded-full bg-gray-700 text-white text-[10px] font-bold text-center flex items-center justify-center">
              {selectedTopics.length}
            </span>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="rounded-none lg:rounded-lg max-w-full! lg:max-w-9/10! max-h-100vh! lg:max-h-[90vh]! w-full! lg:w-9/10! h-[100vh]! lg:h-[90vh]! overflow-y-scroll flex flex-col">
        <DialogHeader className="text-left">
          <DialogTitle className="text-left">
            {searchTerm || selectedCategory
              ? filteredTopics.length
              : allTopics.length}{" "}
            sujets
            {(searchTerm || selectedCategory) &&
              ` (${allTopics.length} au total)`}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 flex-1">
          {/* Search bar and category filters */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 flex-shrink-0 w-full">
            {/* Search bar */}
            <div className="w-full sm:min-w-0 sm:max-w-md lg:max-w-2xl">
              <Input
                type="text"
                placeholder="Rechercher un thème..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Category filters */}
            <div className="w-full sm:w-auto sm:flex-shrink-0 overflow-x-auto">
              <ToggleGroup
                type="single"
                value={selectedCategory}
                onValueChange={(value) => setSelectedCategory(value || "")}
                className="flex flex-nowrap sm:flex-wrap gap-2 justify-start sm:justify-end min-w-max sm:min-w-0"
              >
                <ToggleGroupItem
                  value=""
                  className={`px-3 sm:px-4 py-2 h-auto min-h-[36px] rounded-lg border transition-all duration-200 hover:bg-gray-50 flex-shrink-0 ${
                    selectedCategory === ""
                      ? "bg-blue-100 text-blue-800 border-blue-300"
                      : "border-gray-200"
                  }`}
                >
                  <span className="text-sm font-medium whitespace-nowrap">
                    Toutes
                  </span>
                  <span
                    className={`ml-2 text-xs px-2 py-1 rounded-full transition-all duration-200 flex-shrink-0 ${
                      selectedCategory === ""
                        ? "bg-blue-500 text-white"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {allTopics.length}
                  </span>
                </ToggleGroupItem>
                {categories.map((category) => (
                  <ToggleGroupItem
                    key={category.name}
                    value={category.name}
                    className="px-3 sm:px-4 py-2 h-auto min-h-[36px] rounded-lg border border-gray-200 hover:bg-gray-50 data-[state=on]:bg-blue-100 data-[state=on]:text-blue-800 data-[state=on]:border-blue-300 transition-all duration-200 flex-shrink-0"
                  >
                    <span className="text-sm font-medium whitespace-nowrap">
                      {category.name}
                    </span>
                    <span
                      className={`ml-2 text-xs px-2 py-1 rounded-full transition-all duration-200 flex-shrink-0 ${
                        selectedCategory === category.name
                          ? "bg-blue-500 text-white"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {category.count}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 flex-shrink-0"></div>

          {/* Topics grid */}
          <div className="overflow-y-auto w-fill">
            <div className="flex flex-row gap-2 flex-wrap ">
              {filteredTopics.map(renderTopicChip)}
            </div>
            {filteredTopics.length === 0 && searchTerm && (
              <div className="text-center py-8 text-gray-500">
                Aucun sujet trouvé pour &quot;{searchTerm}&quot;
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
