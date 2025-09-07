"use client";

import { EnhancedAudioPlayer } from "@/components/enhanced-audio-player";
import { RulesDialog } from "@/components/rules-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAutosave } from "@/hooks/use-autosave";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { ArrowLeftIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  rules_explanation_message: string | null;
  category: {
    id: number;
    name: string;
    slug: string;
  };
}

interface Dictation {
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

interface DictationPageProps {
  params: Promise<{ id: string }>;
}

export default function DictationPage({ params }: DictationPageProps) {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const router = useRouter();
  const [dictation, setDictation] = useState<Dictation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dictationId, setDictationId] = useState<string | null>(null);

  // Check if user has a profile selected
  useEffect(() => {
    // Only redirect if we're not loading and we're sure there's no profile
    // Add a small delay to ensure profile context has time to load
    if (!profileLoading && profile === null) {
      // Give the profile context more time to load
      const timer = setTimeout(() => {
        if (!profileLoading && profile === null) {
          router.push("/profiles?message=profile-required");
        }
      }, 500); // Wait 500ms for profile to load

      return () => clearTimeout(timer);
    }
  }, [profile, profileLoading, router]);

  // Use autosave hook for dictation text
  const { value: dictationText, setValue: setDictationText } = useAutosave("", {
    key: dictationId ? `dictation-${dictationId}` : "",
    debounceMs: 500,
    enabled: !!dictationId,
  });

  useEffect(() => {
    const fetchDictation = async () => {
      try {
        const resolvedParams = await params;
        setDictationId(resolvedParams.id);
        const response = await fetch(`/api/dictations/${resolvedParams.id}`);

        if (response.ok) {
          const data = await response.json();
          setDictation(data);
        } else if (response.status === 404) {
          setError("Dictée non trouvée");
        } else {
          setError("Erreur lors du chargement de la dictée");
        }
      } catch (error) {
        console.error("Error fetching dictation:", error);
        setError("Erreur lors du chargement de la dictée");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDictation();
  }, [params]);

  const getImageUrl = (pictureFile: string | null) => {
    if (!pictureFile) return null;
    return `/api/images/${pictureFile}`;
  };

  if (profileLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[200px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de la dictée...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect via useEffect
  }

  if (error || !dictation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || "Dictée non trouvée"}
          </h1>
          <Button asChild variant="ghost">
            <Link
              href="/exercices/dictees"
              className="inline-flex items-center"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Retour aux dictées
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <div className="mb-6">
        <Button asChild variant="ghost">
          <Link href="/exercices/dictees" className="inline-flex items-center">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Retour aux dictées
          </Link>
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-900">
            {dictation.topic.name}
          </h1>
          <RulesDialog
            rulesExplanationMessage={dictation.topic.rules_explanation_message}
          />
        </div>

        {/* Levels and Word Count below title */}
        <div className="flex flex-wrap items-center gap-4 mb-2">
          {/* Word Count */}
          {dictation.count_words && (
            <Badge variant="outline" className="text-gray-600">
              {dictation.count_words} mots
            </Badge>
          )}

          {/* Levels */}
          <div className="flex flex-wrap gap-2">
            {dictation.dictations_levels.map((dictationLevel) => (
              <Badge
                key={dictationLevel.id}
                className="bg-teal-400 text-white border-teal-400 hover:bg-teal-500"
              >
                {dictationLevel.levels.code}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Audio Player - Full Width */}
      {dictation.audio_file && (
        <div className="mb-8">
          <EnhancedAudioPlayer
            audioFile={dictation.audio_file}
            className="flex justify-center"
          />
        </div>
      )}

      {/* Conditional Layout: Two Columns if picture exists, Full Width if no picture */}
      {dictation.picture_file ? (
        <div className="grid grid-cols-4 gap-6">
          {/* Left Column - Picture (25%) */}
          <div className="col-span-1 flex">
            <div className="relative w-full h-full min-h-[200px]">
              <Image
                src={getImageUrl(dictation.picture_file) || ""}
                alt={`Dictée - ${dictation.topic.name}`}
                fill
                className="object-cover rounded-lg"
              />
            </div>
          </div>

          {/* Right Column - Text Area (75%) */}
          <div className="col-span-3 flex">
            <div className="w-full h-full min-h-[200px]">
              <textarea
                value={dictationText}
                onChange={(e) => setDictationText(e.target.value)}
                placeholder="Écrivez votre dictée ici..."
                className="w-full h-full min-h-[200px] p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{
                  minHeight: "200px",
                  height: "200px",
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        /* Full Width Text Area when no picture */
        <div className="w-full">
          <textarea
            value={dictationText}
            onChange={(e) => setDictationText(e.target.value)}
            placeholder="Écrivez votre dictée ici..."
            className="w-full min-h-[200px] p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{
              minHeight: "200px",
              height: "200px",
            }}
          />
        </div>
      )}

      {/* Validate Button */}
      <div className="flex justify-end mt-6">
        <Button size="lg">Valider</Button>
      </div>
    </div>
  );
}
