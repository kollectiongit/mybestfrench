"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { CurrentProfile } from "@/lib/current-profile";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import CategoryFilters from "./components/CategoryFilters";
import DictationCard from "./components/DictationCard";
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import SentenceCountFilter from "./components/SentenceCountFilter";
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
  const [selectedSentenceCount, setSelectedSentenceCount] = useState<
    number | null
  >(null);
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

  // Helper function to get filtered dictations without sentence count filter
  // This is used to calculate the counts in the sentence count filter
  const getFilteredWithoutSentenceCount = useCallback(() => {
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
    return filtered;
  }, [
    dictations,
    searchTerm,
    selectedTopics,
    showAttemptedOnly,
    showNotAttemptedOnly,
  ]);

  const filterDictations = useCallback(() => {
    let filtered = getFilteredWithoutSentenceCount();

    // Apply sentence count filter if selected
    if (selectedSentenceCount !== null) {
      if (selectedSentenceCount === 6) {
        // >5 sentences
        filtered = filtered.filter(
          (dictation) => dictation.sentences_count > 5
        );
      } else {
        filtered = filtered.filter(
          (dictation) => dictation.sentences_count === selectedSentenceCount
        );
      }
    }
    setFilteredDictations(filtered);
  }, [getFilteredWithoutSentenceCount, selectedSentenceCount]);

  useEffect(() => {
    filterDictations();
  }, [filterDictations]);

  // Effect to make cards in the same row have equal height
  useEffect(() => {
    const equalizeCardHeights = () => {
      const grid = document.getElementById("dictations-grid");
      if (!grid) return;

      // Get all card wrappers
      const cardWrappers = grid.querySelectorAll(".dictation-card-wrapper");
      if (cardWrappers.length === 0) return;

      // Reset heights first
      cardWrappers.forEach((wrapper) => {
        (wrapper as HTMLElement).style.height = "auto";
      });

      // Get grid computed styles to determine columns
      const gridStyles = window.getComputedStyle(grid);
      const gridTemplateColumns = gridStyles.gridTemplateColumns;
      const columns = gridTemplateColumns.split(" ").length;

      // Group cards by row
      const rows: HTMLElement[][] = [];
      let currentRow: HTMLElement[] = [];

      cardWrappers.forEach((wrapper, index) => {
        currentRow.push(wrapper as HTMLElement);

        // If we've filled a row or this is the last item
        if ((index + 1) % columns === 0 || index === cardWrappers.length - 1) {
          rows.push([...currentRow]);
          currentRow = [];
        }
      });

      // Set equal height for each row
      rows.forEach((row) => {
        let maxHeight = 0;

        // Find the maximum height in this row
        row.forEach((wrapper) => {
          const height = wrapper.offsetHeight;
          if (height > maxHeight) {
            maxHeight = height;
          }
        });

        // Set all cards in this row to the maximum height
        row.forEach((wrapper) => {
          wrapper.style.height = `${maxHeight}px`;
        });
      });
    };

    // Run on mount and when filtered dictations change
    equalizeCardHeights();

    // Also run on window resize to handle responsive changes
    const handleResize = () => {
      setTimeout(equalizeCardHeights, 100); // Small delay to ensure layout is updated
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [filteredDictations]);

  // Utiliser le profil initial si disponible, sinon le profil du context
  const currentProfile = initialProfile || profile;

  if (profileLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
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
      {/* Header with title and search */}
      <div className="mb-8 flex items-center justify-between gap-4 w-full">
        <Header count={filteredDictations.length} />
        <div className="flex-shrink-0">
          <SearchBar value={searchTerm} onChange={setSearchTerm} />
        </div>
      </div>

      {/* Filtres: Grammaire, Conjugaison, Orthographe, etc. */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <CategoryFilters
          dictations={dictations}
          selectedTopics={selectedTopics}
          setSelectedTopics={setSelectedTopics}
        />
        <StatusFilters
          dictations={dictations}
          showAttemptedOnly={showAttemptedOnly}
          setShowAttemptedOnly={setShowAttemptedOnly}
          showNotAttemptedOnly={showNotAttemptedOnly}
          setShowNotAttemptedOnly={setShowNotAttemptedOnly}
        />
        <SentenceCountFilter
          dictations={dictations}
          selectedSentenceCount={selectedSentenceCount}
          setSelectedSentenceCount={setSelectedSentenceCount}
          filteredDictations={getFilteredWithoutSentenceCount()}
        />
        <TopicDialog
          dictations={dictations}
          selectedTopics={selectedTopics}
          setSelectedTopics={setSelectedTopics}
        />
        {/* Clear all filters button */}
        {(selectedTopics.length > 0 ||
          showAttemptedOnly ||
          showNotAttemptedOnly ||
          selectedSentenceCount !== null) && (
          <div
            className="group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-10 bg-red-500 text-red-50 hover:bg-red-600 hover:scale-105"
            onClick={() => {
              setSelectedTopics([]);
              setShowAttemptedOnly(false);
              setShowNotAttemptedOnly(false);
              setSelectedSentenceCount(null);
            }}
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-xs font-medium">Effacer les filtres</span>
          </div>
        )}
      </div>

      {/* Dictations grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        id="dictations-grid"
      >
        {filteredDictations.map((dictation) => (
          <div key={dictation.id} className="dictation-card-wrapper">
            <DictationCard dictation={dictation} />
          </div>
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
