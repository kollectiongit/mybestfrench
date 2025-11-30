"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EnhancedAudioPlayer } from "./audio-player";

interface DictationSentence {
  audio_file: string;
  order: number;
  text: string;
}

interface DicteeSentencesAudioProps {
  dictationSentences: DictationSentence[];
}

export default function DicteeSentencesAudio({
  dictationSentences,
}: DicteeSentencesAudioProps) {
  const [globalLoopEnabled, setGlobalLoopEnabled] = useState(false);
  const [pauseDuration, setPauseDuration] = useState([2]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [playedAudioIds, setPlayedAudioIds] = useState<Set<string>>(new Set());
  const [currentCardIndex, setCurrentCardIndex] = useState<number | null>(null);

  // Sort sentences by order
  const sortedSentences = [...dictationSentences].sort(
    (a, b) => a.order - b.order
  );

  const decreaseValue = () =>
    setPauseDuration((prev) => [Math.max(0, prev[0] - 1)]);
  const increaseValue = () =>
    setPauseDuration((prev) => [Math.min(10, prev[0] + 1)]);

  const handlePlayStateChange = (isPlaying: boolean, audioId: string) => {
    if (isPlaying) {
      // Pause any currently playing audio
      if (playingAudioId && playingAudioId !== audioId) {
        const currentButton = document.querySelector(
          `[data-audio-id="${playingAudioId}"]`
        ) as HTMLButtonElement;
        currentButton?.click();
      }

      setPlayingAudioId(audioId);
      // Add to played set when audio starts playing
      setPlayedAudioIds((prev) => new Set(prev).add(audioId));
      // Set current card index
      const index = sortedSentences.findIndex((s) => s.audio_file === audioId);
      setCurrentCardIndex(index);
    } else {
      setPlayingAudioId(null);
    }
  };

  const handleCardClick = useCallback(
    (audioId: string) => {
      // Pause any currently playing audio
      if (playingAudioId) {
        const currentButton = document.querySelector(
          `[data-audio-id="${playingAudioId}"]`
        ) as HTMLButtonElement;
        currentButton?.click();
      }

      // Clear all played states when clicking on a new card
      setPlayedAudioIds(new Set([audioId]));
      const index = sortedSentences.findIndex((s) => s.audio_file === audioId);
      setCurrentCardIndex(index);
    },
    [sortedSentences, playingAudioId]
  );

  const navigateAndPlay = useCallback(
    (audioId: string) => {
      // First pause any currently playing audio
      if (playingAudioId) {
        const currentButton = document.querySelector(
          `[data-audio-id="${playingAudioId}"]`
        ) as HTMLButtonElement;
        currentButton?.click();
      }

      // Wait a bit for the pause to take effect, then switch and play
      setTimeout(() => {
        // Clear all played states and set new card
        setPlayedAudioIds(new Set([audioId]));
        const index = sortedSentences.findIndex(
          (s) => s.audio_file === audioId
        );
        setCurrentCardIndex(index);

        // Then play the new audio
        setTimeout(() => {
          const nextButton = document.querySelector(
            `[data-audio-id="${audioId}"]`
          ) as HTMLButtonElement;
          nextButton?.click();
        }, 50);
      }, 100);
    },
    [sortedSentences, playingAudioId]
  );

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "ArrowRight":
            e.preventDefault();
            if (
              currentCardIndex !== null &&
              currentCardIndex < sortedSentences.length - 1
            ) {
              const nextIndex = currentCardIndex + 1;
              const nextAudioId = sortedSentences[nextIndex].audio_file;
              navigateAndPlay(nextAudioId);
            }
            break;
          case "ArrowLeft":
            e.preventDefault();
            if (currentCardIndex !== null && currentCardIndex > 0) {
              const prevIndex = currentCardIndex - 1;
              const prevAudioId = sortedSentences[prevIndex].audio_file;
              navigateAndPlay(prevAudioId);
            }
            break;
          case "ArrowDown":
            e.preventDefault();
            if (currentCardIndex !== null) {
              const currentAudioId =
                sortedSentences[currentCardIndex].audio_file;
              const currentButton = document.querySelector(
                `[data-audio-id="${currentAudioId}"]`
              ) as HTMLButtonElement;
              currentButton?.click();
            }
            break;
          case "ArrowUp":
            e.preventDefault();
            setGlobalLoopEnabled((prev) => !prev);
            break;
        }
      }
    },
    [currentCardIndex, sortedSentences, navigateAndPlay]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!dictationSentences || dictationSentences.length === 0) return null;

  return (
    <div className="mb-8 space-y-4 md:space-y-6">
      {/* Global Controls */}
      <div className="bg-gray-50 rounded-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between md:gap-24">
          {/* Loop Control */}
          <div className="flex items-center gap-2">
            <Switch
              id="global-loop"
              checked={globalLoopEnabled}
              onCheckedChange={setGlobalLoopEnabled}
            />
            <Label
              htmlFor="global-loop"
              className="text-sm font-medium shrink-0"
            >
              Audio loop
            </Label>
          </div>

          {/* Pause Duration Control */}
          <div className="space-y-2 md:space-y-3 w-full md:min-w-[300px]">
            <Label className="tabular-nums text-sm md:text-base">
              {pauseDuration[0]} secondes de pause entre chaque loop
            </Label>
            <div className="flex items-center gap-2 md:gap-4">
              <div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-6 md:size-8"
                  aria-label="Decrease value"
                  onClick={decreaseValue}
                  disabled={pauseDuration[0] === 0}
                >
                  <Minus size={14} strokeWidth={2} aria-hidden="true" />
                </Button>
              </div>
              <Slider
                className="grow"
                value={pauseDuration}
                onValueChange={setPauseDuration}
                min={0}
                max={10}
                step={1}
                aria-label="Pause duration slider"
              />
              <div>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-6 md:size-8"
                  aria-label="Increase value"
                  onClick={increaseValue}
                  disabled={pauseDuration[0] === 10}
                >
                  <Plus size={14} strokeWidth={2} aria-hidden="true" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Audio Cards - 3 per row */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4">
        {sortedSentences.map((sentence) => {
          const isCurrentlyPlaying = playingAudioId === sentence.audio_file;
          const hasBeenPlayed = playedAudioIds.has(sentence.audio_file);
          const isActive = isCurrentlyPlaying || hasBeenPlayed;

          return (
            <Card
              key={sentence.order}
              className={`py-1 md:py-2 transition-all duration-200 cursor-pointer ${
                isActive ? "ring-2 ring-blue-500 bg-blue-50" : "hover:shadow-md"
              }`}
              onClick={() => handleCardClick(sentence.audio_file)}
            >
              <CardContent className="p-2 md:p-4">
                <div className="flex items-center gap-2 md:gap-4">
                  <div className="flex-shrink-0">
                    <span
                      className={`text-xs md:text-sm font-medium rounded-full w-6 h-6 md:w-8 md:h-8 flex items-center justify-center transition-colors duration-200 ${
                        isActive
                          ? "bg-blue-500 text-white"
                          : "text-gray-600 bg-gray-100"
                      }`}
                    >
                      {sentence.order}
                    </span>
                  </div>
                  <div className="flex-1">
                    <EnhancedAudioPlayer
                      audioFile={`https://nrpnakbupjpkdfdvmryr.supabase.co/storage/v1/object/public/audio/dictation-sentence/${sentence.audio_file}`}
                      className=""
                      globalLoopEnabled={globalLoopEnabled}
                      pauseDuration={pauseDuration[0]}
                      audioId={sentence.audio_file}
                      onPlayStateChange={handlePlayStateChange}
                      isCardActive={isActive}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
