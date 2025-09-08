"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useCallback, useEffect, useState } from "react";
import DictationCard from "./components/DictationCard";
import Filters from "./components/Filters";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";

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
  category: {
    id: number;
    name: string;
    slug: string;
  };
}

interface Dictation {
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

// (Header, SearchBar, Filters, DictationCard) are imported components

export default function DicteesPageClient() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [filteredDictations, setFilteredDictations] = useState<Dictation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDictations = async () => {
      try {
        const response = await fetch("/api/dictations");
        if (response.ok) {
          const data = await response.json();
          setDictations(data);
        }
      } catch {}
      setIsLoading(false);
    };
    fetchDictations();
  }, []);

  const filterDictations = useCallback(() => {
    let filtered = dictations;
    if (searchTerm.trim()) {
      filtered = filtered.filter(
        (dictation) =>
          dictation.topic.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          dictation.topic.category.name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          dictation.dictations_levels.some(
            (dl) =>
              dl.levels.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
              dl.levels.label.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }
    if (selectedTopics.length > 0) {
      filtered = filtered.filter((dictation) =>
        selectedTopics.includes(dictation.topic_id)
      );
    }
    setFilteredDictations(filtered);
  }, [dictations, searchTerm, selectedTopics]);

  useEffect(() => {
    filterDictations();
  }, [filterDictations]);

  if (profileLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des dictées...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Header />
      <SearchBar value={searchTerm} onChange={setSearchTerm} />
      <Filters
        dictations={dictations}
        selectedTopics={selectedTopics}
        setSelectedTopics={setSelectedTopics}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDictations.map((dictation) => (
          <DictationCard key={dictation.id} dictation={dictation} />
        ))}
      </div>

      {filteredDictations.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm
              ? "Aucune dictée trouvée pour cette recherche."
              : "Aucune dictée disponible."}
          </p>
        </div>
      )}
    </div>
  );
}
