"use client";

import { EnhancedAudioPlayer } from "@/components/enhanced-audio-player";

export default function DicteeAudio({
  audioFile,
}: {
  audioFile: string | null;
}) {
  if (!audioFile) return null;
  return (
    <div className="mb-8">
      <EnhancedAudioPlayer
        audioFile={audioFile}
        className="flex justify-center"
      />
    </div>
  );
}
