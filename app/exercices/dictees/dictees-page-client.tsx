"use client";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { CurrentProfile } from "@/lib/current-profile";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  addFavoriteDictation,
  removeFavoriteDictation,
} from "./actions";
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
    id: number;
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
  dictation_sentences?: string[];
  sentences_count: number;
  attempts_count: number;
  latest_attempt_at: string | null;
  errors_range: string | null;
  highest_success_percentage: number | null;
  is_favorite: boolean;
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
  const [pendingFavoriteIds, setPendingFavoriteIds] = useState<Set<number>>(
    () => new Set()
  );
  const [animatedFavoriteId, setAnimatedFavoriteId] = useState<number | null>(
    null
  );
  const favoriteAnimationTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const previousDictationsRef = useRef<Dictation[] | null>(null);
  // Utiliser le profil initial si disponible, sinon le profil du context
  const currentProfile = initialProfile || profile;

  const sortDictations = useCallback(
    (items: Dictation[]): Dictation[] => {
      return [...items].sort((a, b) => {
        if (a.is_favorite !== b.is_favorite) {
          return a.is_favorite ? -1 : 1;
        }
        if (a.latest_attempt_at && b.latest_attempt_at) {
          const dateA = new Date(a.latest_attempt_at).getTime();
          const dateB = new Date(b.latest_attempt_at).getTime();
          return dateB - dateA;
        }
        if (a.latest_attempt_at && !b.latest_attempt_at) return -1;
        if (!a.latest_attempt_at && b.latest_attempt_at) return 1;
        if (a.topic.category.id !== b.topic.category.id) {
          return a.topic.category.id - b.topic.category.id;
        }
        if (a.topic.id !== b.topic.id) {
          return a.topic.id - b.topic.id;
        }
        return a.title.localeCompare(b.title);
      });
    },
    []
  );

  // Mettre à jour les dictées quand les données initiales changent
  useEffect(() => {
    const sorted = sortDictations(initialDictations);
    setDictations(sorted);
    setFilteredDictations(sorted);
  }, [initialDictations, sortDictations]);

  // Fonction pour recharger les dictées (si nécessaire)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const refreshDictations = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/dictations");
      if (response.ok) {
        const data = await response.json();
        const sorted = sortDictations(data);
        setDictations(sorted);
        setFilteredDictations(sorted);
      }
    } catch (error) {
      console.error("Error refreshing dictations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [sortDictations]);

  // Helper function to get filtered dictations without sentence count filter
  // This is used to calculate the counts in the sentence count filter
  const getFilteredWithoutSentenceCount = useCallback(
    (source?: Dictation[]) => {
      let filtered = source ?? dictations;
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();

      if (normalizedSearchTerm) {
        filtered = filtered.filter((dictation) => {
          const matchesTitle = dictation.title
            .toLowerCase()
            .includes(normalizedSearchTerm);
          const matchesTopic = dictation.topic.name
            .toLowerCase()
            .includes(normalizedSearchTerm);
          const matchesCategory = dictation.topic.category.name
            .toLowerCase()
            .includes(normalizedSearchTerm);
          const matchesLevel = dictation.levels.some((level) =>
            level.toLowerCase().includes(normalizedSearchTerm)
          );
          const matchesSentence = dictation.dictation_sentences?.some(
            (sentence) => sentence.toLowerCase().includes(normalizedSearchTerm)
          );

          return (
            matchesTitle ||
            matchesTopic ||
            matchesCategory ||
            matchesLevel ||
            matchesSentence
          );
        });
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
        filtered = filtered.filter(
          (dictation) => dictation.attempts_count === 0
        );
      }
      return filtered;
    },
    [
      dictations,
      searchTerm,
      selectedTopics,
      showAttemptedOnly,
      showNotAttemptedOnly,
    ]
  );

  const filterDictations = useCallback(
    (source?: Dictation[]) => {
      let filtered = getFilteredWithoutSentenceCount(source);

      // Apply sentence count filter if selected
      if (selectedSentenceCount !== null) {
        if (selectedSentenceCount === 6) {
          filtered = filtered.filter(
            (dictation) => dictation.sentences_count > 5
          );
        } else {
          filtered = filtered.filter(
            (dictation) => dictation.sentences_count === selectedSentenceCount
          );
        }
      }

      return sortDictations(filtered);
    },
    [getFilteredWithoutSentenceCount, selectedSentenceCount, sortDictations]
  );

  useEffect(() => {
    setFilteredDictations(filterDictations());
  }, [filterDictations]);

  useEffect(
    () => () => {
      if (favoriteAnimationTimeout.current) {
        clearTimeout(favoriteAnimationTimeout.current);
      }
    },
    []
  );

  const handleToggleFavorite = useCallback(
    async (dictationId: number, shouldFavorite: boolean) => {
      if (!currentProfile) return;

      previousDictationsRef.current = dictations;

      const optimisticDictations = dictations.map((dictation) =>
        dictation.id === dictationId
          ? { ...dictation, is_favorite: shouldFavorite }
          : dictation
      );
      const sortedOptimistic = sortDictations(optimisticDictations);

      setDictations(sortedOptimistic);
      setFilteredDictations(filterDictations(sortedOptimistic));

      if (shouldFavorite) {
        if (favoriteAnimationTimeout.current) {
          clearTimeout(favoriteAnimationTimeout.current);
        }
        setAnimatedFavoriteId(dictationId);
        favoriteAnimationTimeout.current = setTimeout(() => {
          setAnimatedFavoriteId((current) =>
            current === dictationId ? null : current
          );
          favoriteAnimationTimeout.current = null;
        }, 800);
      } else if (animatedFavoriteId === dictationId) {
        setAnimatedFavoriteId(null);
      }

      setPendingFavoriteIds((prev) => {
        const next = new Set(prev);
        next.add(dictationId);
        return next;
      });

      try {
        if (shouldFavorite) {
          await addFavoriteDictation(dictationId, currentProfile.id);
        } else {
          await removeFavoriteDictation(dictationId, currentProfile.id);
        }
      } catch (error) {
        console.error("Error toggling favorite dictation:", error);
        const rollback = previousDictationsRef.current ?? dictations;
        const sortedRollback = sortDictations(rollback);
        setDictations(sortedRollback);
        setFilteredDictations(filterDictations(sortedRollback));
        if (favoriteAnimationTimeout.current) {
          clearTimeout(favoriteAnimationTimeout.current);
          favoriteAnimationTimeout.current = null;
        }
        setAnimatedFavoriteId((current) =>
          current === dictationId ? null : current
        );
      } finally {
        setPendingFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(dictationId);
          return next;
        });
      }
    },
    [
      animatedFavoriteId,
      currentProfile,
      dictations,
      filterDictations,
      sortDictations,
    ]
  );

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
    <div className="container mx-auto px-4 py-8 space-y-3">
      {/* Header with title and search (md+): same row with space-between */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="md:mb-0 mb-4">
          <Header count={filteredDictations.length} />
        </div>
        <div className="flex flex-row items-center gap-2 md:max-w-md">
          <div className="flex-1 w-full md:w-auto">
            <SearchBar value={searchTerm} onChange={setSearchTerm} />
          </div>
          {/* Thèmes button on xs */}
          <div className="flex-shrink-0 md:hidden">
            <TopicDialog
              dictations={dictations}
              selectedTopics={selectedTopics}
              setSelectedTopics={setSelectedTopics}
            />
          </div>
        </div>
      </div>

      {/* Filtres: Grammaire, Conjugaison, Orthographe, etc. */}
      <div className="flex flex-wrap items-center gap-2">
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
        {/* Thèmes button (md+) */}
        <div className="hidden md:block">
          <TopicDialog
            dictations={dictations}
            selectedTopics={selectedTopics}
            setSelectedTopics={setSelectedTopics}
          />
        </div>
        {/* Clear all filters button */}
        {(selectedTopics.length > 0 ||
          showAttemptedOnly ||
          showNotAttemptedOnly ||
          selectedSentenceCount !== null) && (
          <div
            className="group relative inline-flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer h-10 bg-red-500 text-red-50 hover:bg-red-600 hover:scale-105"
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
            <DictationCard
              dictation={dictation}
              onToggleFavorite={handleToggleFavorite}
              isFavoritePending={pendingFavoriteIds.has(dictation.id)}
              isFavoriteAnimating={animatedFavoriteId === dictation.id}
              disabled={!currentProfile}
            />
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
