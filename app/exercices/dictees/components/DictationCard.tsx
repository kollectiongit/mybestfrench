"use client";

import { AudioPlayer } from "@/components/audio-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";

interface Level {
  id: number;
  code: string;
  label: string;
  rank: number;
}
interface DictationLevel {
  id: number;
  level_id: number;
  dictation_id: string;
  levels: Level;
}
interface Topic {
  id: number;
  name: string;
  slug: string;
  category: { id: number; name: string; slug: string };
}
export interface Dictation {
  id: string;
  topic_id: number;
  original_text: string | null;
  audio_file: string | null;
  screenshot_file: string | null;
  picture_file: string | null;
  count_words: number | null;
  created_at: string;
  updated_at: string;
  topic: Topic;
  dictations_levels: DictationLevel[];
}

export default function DictationCard({ dictation }: { dictation: Dictation }) {
  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer pt-0 pb-2 gap-0 flex flex-col">
      <CardContent className="p-4 flex flex-col justify-between flex-1">
        <CardTitle
          className="text-lg mb-2 overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer"
          onClick={() =>
            (window.location.href = `/exercices/dictees/${dictation.id}`)
          }
        >
          {dictation.topic.name}
        </CardTitle>

        <div className="space-y-2 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap gap-1">
              {dictation.count_words && (
                <Badge variant="secondary" className="text-xs bg-teal-200">
                  {dictation.count_words} mots
                </Badge>
              )}
              {dictation.dictations_levels.map((dictationLevel) => (
                <Badge
                  key={dictationLevel.id}
                  variant="secondary"
                  className="text-xs "
                >
                  {dictationLevel.levels.code}
                </Badge>
              ))}
            </div>
          </div>

          <div className="col-span-2 flex gap-2 mt-3">
            {dictation.audio_file && (
              <div className="flex-1">
                <AudioPlayer audioFile={dictation.audio_file} className="" />
              </div>
            )}
            <div className="flex-1">
              <Button
                size="sm"
                variant="default"
                className="w-full h-9"
                onClick={() => {
                  window.location.href = `/exercices/dictees/${dictation.id}`;
                }}
              >
                Faire la dictée
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
