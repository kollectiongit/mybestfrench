"use client";

import { Button } from "@/components/ui/button";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface EnhancedAudioPlayerProps {
  audioFile: string;
  className?: string;
  globalLoopEnabled?: boolean;
  pauseDuration?: number;
  audioId?: string;
  onPlayStateChange?: (isPlaying: boolean, audioId: string) => void;
  isCardActive?: boolean;
}

export function EnhancedAudioPlayer({
  audioFile,
  className = "",
  globalLoopEnabled = false,
  pauseDuration = 2,
  audioId = "",
  onPlayStateChange,
  isCardActive = false,
}: EnhancedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  const handlePlayPause = useCallback(async () => {
    if (!audioRef.current) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        onPlayStateChange?.(false, audioId);
      } else {
        setIsLoading(true);
        await audioRef.current.play();
        setIsPlaying(true);
        setIsLoading(false);
        onPlayStateChange?.(true, audioId);
      }
    } catch (error) {
      console.error("Error playing audio:", error);
      setIsLoading(false);
    }
  }, [isPlaying, audioId, onPlayStateChange]);

  const handleSeekBackward = useCallback(() => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, currentTime - 2);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [currentTime]);

  const handleSeekForward = useCallback(() => {
    if (!audioRef.current) return;
    const newTime = Math.min(duration, currentTime + 2);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [currentTime, duration]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = useCallback(() => {
    if (globalLoopEnabled) {
      // Add pause before restarting using global pause duration
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        }
      }, pauseDuration * 1000);
    } else {
      setIsPlaying(false);
      setCurrentTime(0);
      onPlayStateChange?.(false, audioId);
    }
  }, [globalLoopEnabled, pauseDuration, audioId, onPlayStateChange]);

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
  }, [handleError, handleEnded]);

  // Handle keyboard events for spacebar play/pause and arrow keys for seeking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys if no input/textarea is focused
      if (!["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) {
        if (e.code === "Space") {
          e.preventDefault();
          handlePlayPause();
        } else if (e.code === "ArrowLeft") {
          e.preventDefault();
          handleSeekBackward();
        } else if (e.code === "ArrowRight") {
          e.preventDefault();
          handleSeekForward();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handlePlayPause, handleSeekBackward, handleSeekForward]);

  return (
    <div className={`flex justify-center ${className}`}>
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={
          audioFile.startsWith("http") ? audioFile : `/api/audio/${audioFile}`
        }
        preload="none"
      />

      {/* Play Button with Progress Background */}
      <Button
        size="lg"
        onClick={handlePlayPause}
        disabled={isLoading || hasError}
        data-audio-id={audioId}
        className={`h-12 px-6 rounded-full transition-all duration-200 w-full ${
          isPlaying || (isCardActive && currentTime > 0)
            ? "bg-black text-white hover:bg-gray-800"
            : isCardActive
              ? "bg-black text-white hover:bg-gray-800"
              : "bg-gray-500 text-white hover:bg-gray-600"
        }`}
        style={{
          background:
            (isPlaying || (!isPlaying && isCardActive && currentTime > 0)) &&
            duration > 0
              ? `linear-gradient(to right, #1f2937 0%, #1f2937 ${(currentTime / duration) * 100}%, #374151 ${(currentTime / duration) * 100}%, #374151 100%)`
              : undefined,
        }}
      >
        {hasError ? (
          "Erreur"
        ) : isPlaying ? (
          <PauseIcon className="h-5 w-5 mr-2" />
        ) : (
          <PlayIcon className="h-5 w-5 mr-2" />
        )}
        {hasError ? "Fichier non trouvé" : isPlaying ? "Pause" : "Écouter"}
      </Button>
    </div>
  );
}
