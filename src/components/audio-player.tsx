"use client";

import { Button } from "@/components/ui/button";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  audioFile: string;
  className?: string;
}

export function AudioPlayer({ audioFile, className = "" }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const handlePlayPause = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        setIsLoading(true);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsLoading(false);
    }
  }, [isPlaying]);

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  }, []);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleError = useCallback(() => {
    setIsPlaying(false);
    setIsLoading(false);
    setHasError(true);
    console.error("Error loading audio file:", audioFile);
  }, [audioFile]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
    };
  }, [handleTimeUpdate, handleLoadedMetadata, handleEnded, handleError]);

  // Handle keyboard events for spacebar play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle spacebar if no input/textarea is focused
      if (
        e.code === "Space" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        handlePlayPause();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePlayPause]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={`/api/audio/${audioFile}`}
        preload="metadata"
      />

      {/* Controls */}
      <div className="flex items-center justify-center">
        <Button
          size="sm"
          variant="outline"
          onClick={handlePlayPause}
          disabled={isLoading || hasError}
          className="w-full h-9 relative overflow-hidden"
          style={{
            background:
              duration > 0
                ? `linear-gradient(to right, #f3f4f6 0%, #f3f4f6 ${(currentTime / duration) * 100}%, #ffffff ${(currentTime / duration) * 100}%, #ffffff 100%)`
                : undefined,
          }}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900" />
          ) : hasError ? (
            "Erreur"
          ) : isPlaying ? (
            <PauseIcon className="h-4 w-4 mr-2" />
          ) : (
            <PlayIcon className="h-4 w-4 mr-2" />
          )}
          {isLoading
            ? "Chargement..."
            : hasError
              ? "Fichier non trouvé"
              : isPlaying
                ? "Pause"
                : "Écouter"}
        </Button>
      </div>
    </div>
  );
}
