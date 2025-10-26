"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

export default function SentenceCountFilter({
  dictations,
  selectedSentenceCount,
  setSelectedSentenceCount,
  filteredDictations,
}: {
  dictations: Dictation[];
  selectedSentenceCount: number | null;
  setSelectedSentenceCount: (v: number | null) => void;
  filteredDictations?: Dictation[];
}) {
  // Use filtered dictations if provided, otherwise use all dictations
  const dictationsToCount = filteredDictations || dictations;

  // Define sentence count ranges
  const sentenceCountOptions = [
    { value: 1, label: "1 phrase" },
    { value: 2, label: "2 phrases" },
    { value: 3, label: "3 phrases" },
    { value: 4, label: "4 phrases" },
    { value: 5, label: "5 phrases" },
    { value: 6, label: ">5 phrases" }, // 6 represents >5
  ];

  // Count dictations for each sentence count option based on the filtered dictations
  const getCount = (value: number) => {
    if (value === 6) {
      // >5 sentences
      return dictationsToCount.filter((d) => d.sentences_count > 5).length;
    }
    return dictationsToCount.filter((d) => d.sentences_count === value).length;
  };

  const handleValueChange = (value: string) => {
    if (value === "all") {
      setSelectedSentenceCount(null);
    } else {
      setSelectedSentenceCount(parseInt(value));
    }
  };

  const getDisplayLabel = () => {
    if (selectedSentenceCount === null) {
      return "Phrases";
    }
    const selectedOption = sentenceCountOptions.find(
      (opt) => opt.value === selectedSentenceCount
    );
    return selectedOption ? selectedOption.label : "Phrases";
  };

  const getDisplayCount = () => {
    return selectedSentenceCount === null
      ? dictationsToCount.length
      : getCount(selectedSentenceCount);
  };

  const isActive = selectedSentenceCount !== null;

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-white cursor-pointer h-10 transition-all duration-200 ${
        isActive ? "border-gray-700 text-gray-700" : "border hover:bg-gray-50"
      }`}
    >
      <Select
        value={
          selectedSentenceCount === null
            ? "all"
            : selectedSentenceCount.toString()
        }
        onValueChange={handleValueChange}
      >
        <SelectTrigger className="border-0 p-0 h-auto w-auto focus:ring-0 focus-visible:ring-0">
          <SelectValue>
            <span className="text-xs font-medium">{getDisplayLabel()}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            <div className="flex items-center gap-2 w-full">
              <span>Toutes</span>
              <span className="ml-auto h-6 w-6 rounded-full bg-gray-700 text-white text-[10px] font-bold text-center flex items-center justify-center">
                {dictationsToCount.length}
              </span>
            </div>
          </SelectItem>
          {sentenceCountOptions.map((option) => {
            const count = getCount(option.value);
            return (
              <SelectItem key={option.value} value={option.value.toString()}>
                <div className="flex items-center gap-2 w-full">
                  <span>{option.label}</span>
                  <span className="ml-auto h-6 w-6 rounded-full bg-gray-700 text-white text-[10px] font-bold text-center flex items-center justify-center">
                    {count}
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <span
        className={`h-6 w-6 rounded-full text-center flex items-center justify-center shrink-0 text-[10px] font-bold ${
          isActive ? "bg-gray-100 text-gray-600" : "bg-gray-100 text-gray-600"
        }`}
      >
        {getDisplayCount()}
      </span>
    </div>
  );
}
