"use client";

import { AudioPlayer } from "@/components/audio-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { PencilLineIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

export default function DicteesPage() {
  const { profile, isLoading: profileLoading } = useCurrentProfile();
  const router = useRouter();
  const [dictations, setDictations] = useState<Dictation[]>([]);
  const [filteredDictations, setFilteredDictations] = useState<Dictation[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchDictations = async () => {
    try {
      const response = await fetch("/api/dictations");
      if (response.ok) {
        const data = await response.json();
        setDictations(data);
      } else {
        console.error("Failed to fetch dictations");
      }
    } catch (error) {
      console.error("Error fetching dictations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterDictations = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredDictations(dictations);
      return;
    }

    const filtered = dictations.filter(
      (dictation) =>
        dictation.topic.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dictation.topic.category.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        dictation.dictations_levels.some(
          (dl) =>
            dl.levels.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dl.levels.label.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );
    setFilteredDictations(filtered);
  }, [dictations, searchTerm]);

  useEffect(() => {
    fetchDictations();
  }, []);

  useEffect(() => {
    filterDictations();
  }, [filterDictations]);

  const getImageUrl = (pictureFile: string | null) => {
    if (!pictureFile) return null;
    return `/api/images/${pictureFile}`;
  };

  if (profileLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des dictées...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect via useEffect
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dictées</h1>
        <p className="text-gray-600">
          Choisis une dictée pour t&apos;entrainer
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Rechercher une dictée par thème, catégorie ou niveau..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Dictations Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDictations.map((dictation) => (
          <Card
            key={dictation.id}
            className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer pt-0 pb-2 gap-0"
          >
            <CardHeader className="p-0">
              <div
                className="relative aspect-square w-full cursor-pointer"
                onClick={() =>
                  (window.location.href = `/exercices/dictees/${dictation.id}`)
                }
              >
                {dictation.picture_file ? (
                  <Image
                    src={getImageUrl(dictation.picture_file) || ""}
                    alt={`Dictée - ${dictation.topic.name}`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <p className="text-gray-500 text-sm">Aucune image</p>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <CardTitle
                className="text-lg mb-2 overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer"
                onClick={() =>
                  (window.location.href = `/exercices/dictees/${dictation.id}`)
                }
              >
                {dictation.topic.name}
              </CardTitle>

              <div className="space-y-2">
                {/* Word Count */}
                {dictation.count_words && (
                  <div className="text-sm text-gray-600">
                    {dictation.count_words} mots
                  </div>
                )}

                {/* Levels */}
                <div className="flex flex-wrap gap-1">
                  {dictation.dictations_levels.map((dictationLevel) => (
                    <Badge
                      key={dictationLevel.id}
                      variant="secondary"
                      className="text-xs"
                    >
                      {dictationLevel.levels.code}
                    </Badge>
                  ))}
                </div>

                {/* Buttons Row */}
                <div className="col-span-2 flex gap-2 mt-3">
                  {/* Audio Player */}
                  {dictation.audio_file && (
                    <div className="flex-1">
                      <AudioPlayer
                        audioFile={dictation.audio_file}
                        className=""
                      />
                    </div>
                  )}

                  {/* Faire la dictée Button */}
                  <div className="flex-1">
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full h-9"
                      onClick={() => {
                        window.location.href = `/exercices/dictees/${dictation.id}`;
                      }}
                    >
                      <PencilLineIcon className="h-4 w-4 mr-2" />
                      Faire la dictée
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDictations.length === 0 && !isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            {searchTerm
              ? "Aucune dictée trouvée pour cette recherche."
              : "Aucune dictée disponible."}
          </p>
        </div>
      )}
    </div>
  );
}
