"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { CurrentProfile } from "@/lib/current-profile";
import { useCallback, useEffect, useState } from "react";
import CategoryFilters from "./components/CategoryFilters";
import DictationCard from "./components/DictationCard";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import StatusFilters from "./components/StatusFilters";
import TopicDialog from "./components/TopicDialog";

interface Topic {
  id: number;
  name: string;
  category: {
    name: string;
  };
}

interface Dictation {
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
  highest_success_percentage: number | null;
}

// Props pour les données pré-chargées
interface DicteesPageClientProps {
  initialDictations?: Dictation[];
  initialProfile?: CurrentProfile | null;
}

export default function DicteesPageClient({
  initialDictations = [],
  initialProfile = null,
}: DicteesPageClientProps) {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [dictations, setDictations] = useState<Dictation[]>(initialDictations);
  const [filteredDictations, setFilteredDictations] =
    useState<Dictation[]>(initialDictations);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<number[]>([]);
  const [showAttemptedOnly, setShowAttemptedOnly] = useState(false);
  const [showNotAttemptedOnly, setShowNotAttemptedOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // Plus de loading initial

  // Mettre à jour les dictées quand les données initiales changent
  useEffect(() => {
    setDictations(initialDictations);
    setFilteredDictations(initialDictations);
  }, [initialDictations]);

  // Fonction pour recharger les dictées (si nécessaire)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const refreshDictations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/dictations");
      if (response.ok) {
        const data = await response.json();
        setDictations(data);
        setFilteredDictations(data);
      }
    } catch (error) {
      console.error("Error refreshing dictations:", error);
    } finally {
      setIsLoading(false);
    }
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
          dictation.levels.some((level) =>
            level.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }
    if (selectedTopics.length > 0) {
      filtered = filtered.filter((dictation) =>
        selectedTopics.includes(dictation.topic.id)
      );
    }
    if (showAttemptedOnly) {
      filtered = filtered.filter((dictation) => dictation.attempts_count > 0);
    }
    if (showNotAttemptedOnly) {
      filtered = filtered.filter((dictation) => dictation.attempts_count === 0);
    }
    setFilteredDictations(filtered);
  }, [
    dictations,
    searchTerm,
    selectedTopics,
    showAttemptedOnly,
    showNotAttemptedOnly,
  ]);

  useEffect(() => {
    filterDictations();
  }, [filterDictations]);

  // Utiliser le profil initial si disponible, sinon le profil du context
  const currentProfile = initialProfile || profile;

  if (profileLoading) {
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

  if (!currentProfile) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Header count={filteredDictations.length} />

      {/* Alignement horizontal des filtres */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <StatusFilters
          dictations={dictations}
          showAttemptedOnly={showAttemptedOnly}
          setShowAttemptedOnly={setShowAttemptedOnly}
          showNotAttemptedOnly={showNotAttemptedOnly}
          setShowNotAttemptedOnly={setShowNotAttemptedOnly}
        />
        <CategoryFilters
          dictations={dictations}
          selectedTopics={selectedTopics}
          setSelectedTopics={setSelectedTopics}
        />
      </div>

      {/* Dialog pour les sujets */}
      <div className="mb-6">
        <TopicDialog
          dictations={dictations}
          selectedTopics={selectedTopics}
          setSelectedTopics={setSelectedTopics}
        />
      </div>

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
