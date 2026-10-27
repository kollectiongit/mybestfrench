"use client";

import { cn } from "@/lib/utils";
import { Check, Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Voice {
  voice_id: string;
  name: string;
  description: string | null;
  gender: string | null;
  accent: string | null;
  preview_url: string | null;
  is_french: boolean;
}

const GENDERS: Record<string, string> = { female: "voix féminine", male: "voix masculine" };

/**
 * Voice of the "prof" for this profile. The samples come from ElevenLabs'
 * preview URLs, so listening to them costs no credit.
 */
export default function VoiceSettings({
  voiceId,
  onVoiceIdChange,
}: {
  voiceId: string | null;
  onVoiceIdChange: (v: string | null) => void;
}) {
  const [data, setData] = useState<{
    configured: boolean;
    voices: Voice[];
    default_voice_id: string | null;
    error?: string;
  } | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/tts/voices")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ configured: false, voices: [], default_voice_id: null }));
    return () => audio.current?.pause();
  }, []);

  const preview = (v: Voice) => {
    audio.current?.pause();
    if (playing === v.voice_id || !v.preview_url) {
      setPlaying(null);
      return;
    }
    const a = new Audio(v.preview_url);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.play().then(() => setPlaying(v.voice_id)).catch(() => setPlaying(null));
  };

  const voices = data?.voices ?? [];
  const french = voices.filter((v) => v.is_french);
  const shown = showAll || french.length === 0 ? voices : french;
  const defaultVoice = voices.find((v) => v.voice_id === data?.default_voice_id);

  return (
    <fieldset className="space-y-3 border-t pt-4">
      <legend className="text-sm font-medium leading-none text-foreground">Voix du prof</legend>
      <p className="text-sm text-muted-foreground">
        La voix qui lit les leçons, les consignes et les explications quand {"l'enfant"} clique sur ▶. Voix générée par IA.
      </p>

      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement des voix…
        </p>
      ) : !data.configured ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          La lecture à voix haute {"n'est"} pas encore activée : il manque la clé ElevenLabs (<code>ELEVENLABS_API_KEY</code>).
        </p>
      ) : voices.length === 0 ? (
        <p className="text-sm text-muted-foreground">{data.error ?? "Aucune voix dans le compte ElevenLabs."}</p>
      ) : (
        <div className="space-y-2">
          <VoiceRow
            selected={voiceId == null}
            onSelect={() => onVoiceIdChange(null)}
            title="Voix par défaut"
            subtitle={defaultVoice ? defaultVoice.name : undefined}
          />
          {shown.map((v) => (
            <VoiceRow
              key={v.voice_id}
              selected={voiceId === v.voice_id}
              onSelect={() => onVoiceIdChange(v.voice_id)}
              title={v.name}
              subtitle={[v.gender && GENDERS[v.gender], v.accent, v.description].filter(Boolean).join(" · ")}
              playing={playing === v.voice_id}
              onPreview={v.preview_url ? () => preview(v) : undefined}
            />
          ))}
          {french.length > 0 && french.length < voices.length && (
            <button type="button" className="text-sm text-sky-700 hover:underline" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Afficher seulement les voix françaises" : "Afficher toutes les voix"}
            </button>
          )}
        </div>
      )}
    </fieldset>
  );
}

function VoiceRow({
  selected,
  onSelect,
  title,
  subtitle,
  playing,
  onPreview,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  playing?: boolean;
  onPreview?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border-2 px-3 py-2",
        selected ? "border-sky-500 bg-sky-50" : "border-gray-200"
      )}
    >
      <button type="button" onClick={onSelect} className="flex flex-1 items-center gap-3 text-left">
        <span
          className={cn(
            "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-sky-500 bg-sky-500 text-white" : "border-gray-300"
          )}
        >
          {selected && <Check className="size-3" />}
        </span>
        <span>
          <span className="block text-sm font-medium">{title}</span>
          {subtitle && <span className="block text-xs text-muted-foreground">{subtitle}</span>}
        </span>
      </button>
      {onPreview && (
        <button
          type="button"
          onClick={onPreview}
          title={playing ? "Arrêter" : "Écouter un extrait"}
          className="flex size-8 items-center justify-center rounded-full text-sky-600 hover:bg-sky-100"
        >
          {playing ? <Square className="size-3.5 fill-current" /> : <Volume2 className="size-4" />}
        </button>
      )}
    </div>
  );
}
