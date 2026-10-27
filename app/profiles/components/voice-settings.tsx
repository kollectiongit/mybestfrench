"use client";

import { isDeviceSpeechSupported, pickDeviceVoice, speakOnDevice } from "@/components/speak-button";
import { cn } from "@/lib/utils";
import { Check, Loader2, Shuffle, Smartphone, Square, User, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Voice {
  voice_id: string;
  name: string;
  display_name: string;
  description: string | null;
  gender: string | null;
  accent: string | null;
  preview_url: string | null;
  is_french: boolean;
}

export type VoiceMode = "fixed" | "rotate" | "device";

const GENDERS: Record<string, string> = { female: "voix féminine", male: "voix masculine" };

/**
 * Voice of the "prof" for this profile: one fixed ElevenLabs voice, a different
 * one for each training session among the ticked ones, or the device's own
 * voice (Web Speech API, free). The ElevenLabs samples come from their preview
 * URLs, so listening to them costs no credit.
 */
export default function VoiceSettings({
  voiceId,
  onVoiceIdChange,
  mode,
  onModeChange,
  voiceIds,
  onVoiceIdsChange,
}: {
  voiceId: string | null;
  onVoiceIdChange: (v: string | null) => void;
  mode: VoiceMode;
  onModeChange: (m: VoiceMode) => void;
  voiceIds: string[];
  onVoiceIdsChange: (ids: string[]) => void;
}) {
  const [data, setData] = useState<{
    configured: boolean;
    voices: Voice[];
    default_voice_id: string | null;
    error?: string;
  } | null>(null);
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
  const defaultVoice = voices.find((v) => v.voice_id === data?.default_voice_id);
  // In rotation, no ticked voice means "all voices"
  const ticked = voiceIds.filter((id) => voices.some((v) => v.voice_id === id));
  const isTicked = (id: string) => ticked.length === 0 || ticked.includes(id);
  const toggle = (id: string) => {
    const current = ticked.length ? ticked : voices.map((v) => v.voice_id);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    if (next.length === 0) return; // at least one voice
    onVoiceIdsChange(next.length === voices.length ? [] : next);
  };

  const subtitle = (v: Voice) =>
    [v.gender && GENDERS[v.gender], v.accent, v.description].filter(Boolean).join(" · ");

  return (
    <fieldset className="space-y-3 border-t pt-4">
      <legend className="text-sm font-medium leading-none text-foreground">Voix du prof</legend>
      <p className="text-sm text-muted-foreground">
        La voix qui lit les leçons, les consignes et les explications quand {"l'enfant"} clique sur 🔊 (voix de synthèse).
      </p>

      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Chargement des voix…
        </p>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {([
              ["rotate", "Une voix différente à chaque session", Shuffle],
              ["fixed", "Toujours la même voix", User],
              ["device", "Voix de l'appareil (gratuite)", Smartphone],
            ] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-left text-sm font-medium",
                  mode === value ? "border-sky-500 bg-sky-50 text-sky-900" : "border-gray-200"
                )}
              >
                <Icon className="size-4 shrink-0" /> {label}
              </button>
            ))}
          </div>

          {mode === "device" ? (
            <DeviceVoicePanel />
          ) : !data.configured ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Les voix ElevenLabs ne sont pas activées (clé <code>ELEVENLABS_API_KEY</code> manquante) : la voix de {"l'appareil"} sera utilisée.
            </p>
          ) : voices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.error ?? "Aucune voix française dans le compte ElevenLabs."} La voix de {"l'appareil"} sera utilisée.
            </p>
          ) : mode === "rotate" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Coche les voix que {"l'enfant"} peut entendre. Une voix est tirée au hasard à chaque nouvelle session, jamais la même que la fois précédente.
              </p>
              {voices.map((v) => (
                <VoiceRow
                  key={v.voice_id}
                  kind="checkbox"
                  selected={isTicked(v.voice_id)}
                  onSelect={() => toggle(v.voice_id)}
                  title={v.display_name}
                  subtitle={subtitle(v)}
                  playing={playing === v.voice_id}
                  onPreview={v.preview_url ? () => preview(v) : undefined}
                />
              ))}
            </>
          ) : (
            <>
              <VoiceRow
                kind="radio"
                selected={voiceId == null}
                onSelect={() => onVoiceIdChange(null)}
                title="Voix par défaut"
                subtitle={defaultVoice ? defaultVoice.display_name : undefined}
              />
              {voices.map((v) => (
                <VoiceRow
                  key={v.voice_id}
                  kind="radio"
                  selected={voiceId === v.voice_id}
                  onSelect={() => onVoiceIdChange(v.voice_id)}
                  title={v.display_name}
                  subtitle={subtitle(v)}
                  playing={playing === v.voice_id}
                  onPreview={v.preview_url ? () => preview(v) : undefined}
                />
              ))}
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

function DeviceVoicePanel() {
  const [voiceName, setVoiceName] = useState<string | null | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  const supported = isDeviceSpeechSupported();

  useEffect(() => {
    if (!supported) return;
    pickDeviceVoice().then((v) => setVoiceName(v ? `${v.name} (${v.lang})` : null));
    return () => stop.current?.();
  }, [supported]);

  const test = async () => {
    if (playing) {
      stop.current?.();
      return;
    }
    setPlaying(true);
    stop.current = await speakOnDevice(
      "Bonjour ! Je suis la voix de ton appareil. Souligne les verbes en rouge et les sujets en vert.",
      () => setPlaying(false)
    );
  };

  return (
    <div className="space-y-2 rounded-lg border-2 border-sky-200 bg-sky-50/50 p-3 text-sm">
      <p>
        Gratuite et instantanée : {"c'est"} la voix intégrée au téléphone, à la tablette ou à {"l'ordinateur"}. Sa qualité dépend de {"l'appareil"} (très correcte sur iPhone, iPad et Mac).
      </p>
      {!supported ? (
        <p className="text-amber-800">Ce navigateur ne propose pas de voix de synthèse.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={test}
            className="inline-flex items-center gap-1.5 rounded-md border border-sky-300 bg-white px-3 py-1.5 font-medium text-sky-800 hover:bg-sky-100"
          >
            {playing ? <Square className="size-3.5 fill-current" /> : <Volume2 className="size-4" />}
            {playing ? "Arrêter" : "Tester sur cet appareil"}
          </button>
          <span className="text-xs text-muted-foreground">
            {voiceName === undefined
              ? "Recherche d'une voix française…"
              : voiceName
                ? `Voix utilisée ici : ${voiceName}`
                : "Aucune voix française sur cet appareil : la voix par défaut sera utilisée."}
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Elle sert aussi automatiquement de secours si ElevenLabs ne répond pas.
      </p>
    </div>
  );
}

function VoiceRow({
  kind,
  selected,
  onSelect,
  title,
  subtitle,
  playing,
  onPreview,
}: {
  kind: "radio" | "checkbox";
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
            "flex size-5 shrink-0 items-center justify-center border-2",
            kind === "radio" ? "rounded-full" : "rounded",
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
