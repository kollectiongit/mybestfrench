"use client";

import { Button } from "@/components/ui/button";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface EnhancedAudioPlayerProps {
  audioFile: string;
  className?: string;
}

export function EnhancedAudioPlayer({
  audioFile,
  className = "",
}: EnhancedAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isHovering, setIsHovering] = useState(false);

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

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

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;

    const newTime = parseFloat(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const time = percentage * duration;
    setHoverTime(time);
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    setHoverTime(null);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

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
  }, [handleError]);

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
    <div
      className={`bg-gray-100 rounded-lg flex flex-row  gap-4 p-8 w-full ${className}`}
    >
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={`/api/audio/${audioFile}`}
        preload="metadata"
      />

      {/* Timeline Section */}
      <div className="space-y-2 w-full">
        {/* Progress Bar with Tooltip */}
        <div className="relative">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="w-full h-3 bg-gray-300 rounded-lg appearance-none cursor-pointer enhanced-slider"
            style={{
              background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${
                (currentTime / duration) * 100
              }%, #d1d5db ${(currentTime / duration) * 100}%, #d1d5db 100%)`,
            }}
          />

          {/* Tooltip */}
          {isHovering && hoverTime !== null && (
            <div
              className="absolute bottom-full mb-2 px-2 py-1 bg-gray-200 text-white text-xs rounded shadow-lg pointer-events-none"
              style={{
                left: `${(hoverTime / duration) * 100}%`,
                transform: "translateX(-50%)",
              }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Time Display */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Play Button - Centered below timeline */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handlePlayPause}
          disabled={isLoading || hasError}
          className="h-12 px-6 rounded-full"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
          ) : hasError ? (
            "Erreur"
          ) : isPlaying ? (
            <PauseIcon className="h-5 w-5 mr-2" />
          ) : (
            <PlayIcon className="h-5 w-5 mr-2" />
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
