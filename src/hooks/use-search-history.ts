import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dictation-search-history";
const MAX_HISTORY = 50;
const DEBOUNCE_DELAY = 5000; // 5 seconds

export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as string[];
        setHistory(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error("Failed to load search history:", error);
      setHistory([]);
    }
  }, []);

  // Get current history
  const getHistory = useCallback(() => {
    return history;
  }, [history]);

  // Add a search term to history with debounce
  const addSearch = useCallback(
    (term: string) => {
      if (!term || term.trim() === "") return;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(() => {
        setHistory((prev) => {
          // Remove duplicates and add to front
          const filtered = prev.filter((item) => item !== term);
          const updated = [term, ...filtered].slice(0, MAX_HISTORY);

          // Save to localStorage
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch (error) {
            console.error("Failed to save search history:", error);
          }

          return updated;
        });
      }, DEBOUNCE_DELAY);
    },
    []
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear search history:", error);
    }
  }, []);

  // Remove a specific item from history
  const removeFromHistory = useCallback(
    (term: string) => {
      setHistory((prev) => {
        const updated = prev.filter((item) => item !== term);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (error) {
          console.error("Failed to update search history:", error);
        }
        return updated;
      });
    },
    []
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    history,
    getHistory,
    addSearch,
    clearHistory,
    removeFromHistory,
  };
}
