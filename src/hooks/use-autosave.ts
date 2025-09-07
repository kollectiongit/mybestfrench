import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutosaveOptions {
  /**
   * The key to use for localStorage
   */
  key: string;
  /**
   * Debounce delay in milliseconds (default: 500ms)
   */
  debounceMs?: number;
  /**
   * Whether to enable autosave (default: true)
   */
  enabled?: boolean;
}

/**
 * A hook that provides autosave functionality with debouncing
 * @param initialValue The initial value for the input
 * @param options Configuration options
 * @returns An object with value, setValue, clearSavedValue, and isSaving
 */
export function useAutosave(
  initialValue: string = '',
  options: UseAutosaveOptions
) {
  const { key, debounceMs = 500, enabled = true } = options;
  const [value, setValue] = useState<string>(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Load saved value from localStorage on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      const savedValue = localStorage.getItem(key);
      if (savedValue !== null) {
        setValue(savedValue);
      }
    } catch (error) {
      console.warn(`Failed to load saved value for key "${key}":`, error);
    }
    
    isInitializedRef.current = true;
  }, [key, enabled]);

  // Save to localStorage with debouncing
  const saveToStorage = useCallback(
    (newValue: string) => {
      if (!enabled || !isInitializedRef.current) return;

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set saving state
      setIsSaving(true);

      // Set new timeout
      timeoutRef.current = setTimeout(() => {
        try {
          localStorage.setItem(key, newValue);
        } catch (error) {
          console.warn(`Failed to save value for key "${key}":`, error);
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    },
    [key, debounceMs, enabled]
  );

  // Update value and trigger save
  const updateValue = useCallback(
    (newValue: string) => {
      setValue(newValue);
      saveToStorage(newValue);
    },
    [saveToStorage]
  );

  // Clear saved value from localStorage
  const clearSavedValue = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setValue(initialValue);
    } catch (error) {
      console.warn(`Failed to clear saved value for key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    value,
    setValue: updateValue,
    clearSavedValue,
    isSaving,
  };
}
