"use client";

import DictationCard, { Dictation } from "@/components/commons/DictationCard";
import {
  addFavoriteDictation,
  removeFavoriteDictation,
} from "../../../app/exercices/dictees/actions";

import { useCurrentProfile } from "@/hooks/use-current-profile";
import { useCallback, useEffect, useRef, useState } from "react";

export function FavoriteDictationsSection() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  // Fetch favorite dictations
  const fetchFavoriteDictations = useCallback(async () => {
    if (!profile) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/dictations/favorites");
      if (response.ok) {
        const data = await response.json();
        setDictations(data);
      } else {
        setError("Failed to fetch favorite dictations");
      }
    } catch (err) {
      console.error("Error fetching favorite dictations:", err);
      setError("Network error while fetching favorite dictations");
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  // Fetch when profile is available
  useEffect(() => {
    if (!profileLoading && profile) {
      fetchFavoriteDictations();
    }
  }, [profile, profileLoading, fetchFavoriteDictations]);

  // Cleanup animation timeout
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
      if (!profile) return;

      previousDictationsRef.current = dictations;

      // Optimistic update: remove from list if unfavoriting
      const optimisticDictations = shouldFavorite
        ? dictations
        : dictations.filter((dictation) => dictation.id !== dictationId);

      setDictations(optimisticDictations);

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
          await addFavoriteDictation(dictationId, profile.id);
          // Refresh the list after adding favorite
          await fetchFavoriteDictations();
        } else {
          await removeFavoriteDictation(dictationId, profile.id);
          // List already updated optimistically
        }
      } catch (error) {
        console.error("Error toggling favorite dictation:", error);
        // Rollback on error
        const rollback = previousDictationsRef.current ?? dictations;
        setDictations(rollback);
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
    [profile, dictations, animatedFavoriteId, fetchFavoriteDictations]
  );

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-4xl font-bold">Dictées de la semaine</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-4xl font-bold">Dictées de la semaine</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des dictées favorites...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h2 className="text-4xl font-bold">Dictées de la semaine</h2>
        <div className="text-center py-8">
          <p className="text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-4xl font-bold">Dictées de la semaine</h2>
      {dictations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            Aucune dictée favorite pour le moment.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dictations.map((dictation) => (
            <div key={dictation.id} className="dictation-card-wrapper">
              <DictationCard
                dictation={dictation}
                onToggleFavorite={handleToggleFavorite}
                isFavoritePending={pendingFavoriteIds.has(dictation.id)}
                isFavoriteAnimating={animatedFavoriteId === dictation.id}
                disabled={!profile}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
