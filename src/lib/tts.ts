import { prisma } from "@/lib/prisma";
import { createClient } from "@/utils/spabase/server";
import { createHash } from "crypto";
import { cookies } from "next/headers";

// ElevenLabs text-to-speech. Audio is generated on demand only (first click on
// ▶), then cached in the Supabase "audio" bucket so a text is paid once per voice.

export const TTS_MODEL_ID = "eleven_v4_turbo";
export const TTS_MAX_CHARS = 1500;
const API = "https://api.elevenlabs.io";
const BUCKET = "audio";

/** ElevenLabs refused for billing reasons (e.g. library voice on the free plan). */
export class TtsPlanError extends Error {}

export function isTtsConfigured() {
  return !!process.env.ELEVENLABS_API_KEY;
}

function apiKey() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY is not defined");
  return key;
}

/** Markdown and layout characters must not be read aloud. */
export function cleanTextForSpeech(text: string) {
  return text
    .replace(/_{3,}/g, " … ") // blanks of a fill-in sentence
    .replace(/\*\*|__|[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Voices
// ---------------------------------------------------------------------------

export interface TtsVoice {
  voice_id: string;
  name: string;
  /** Short name shown to the child ("Yann", "Paul K") */
  display_name: string;
  description: string | null;
  gender: string | null;
  accent: string | null;
  preview_url: string | null;
  is_french: boolean;
}

interface ElevenVoice {
  voice_id: string;
  name: string;
  category?: string | null;
  description?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string>;
  verified_languages?: { language: string; accent?: string | null; preview_url?: string | null }[];
}

let voicesCache: { at: number; voices: TtsVoice[] } | null = null;
const VOICES_TTL_MS = 60 * 60 * 1000;

/** "Voix Nicolas Petit IA AUDIO Narration" -> "Nicolas Petit", "Yann - Narrator" -> "Yann" */
export function voiceDisplayName(name: string) {
  const first = name.split(/\s+[-–—|]\s+/)[0].replace(/^voix\s+/i, "").trim();
  const words = first.split(/\s+/);
  return (words.length > 3 ? words.slice(0, 2) : words).join(" ");
}

/**
 * Voices of the ElevenLabs account ("My Voices"), French ones first. ElevenLabs'
 * generic "premade" voices are left out: they have an English accent in French
 * and are retired on December 31, 2026.
 */
export async function listVoices(): Promise<TtsVoice[]> {
  if (voicesCache && Date.now() - voicesCache.at < VOICES_TTL_MS) return voicesCache.voices;

  const res = await fetch(`${API}/v2/voices?page_size=100`, {
    headers: { "xi-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ElevenLabs voices: ${res.status}`);
  const data = (await res.json()) as { voices: ElevenVoice[] };

  const voices = data.voices
    .filter((v) => v.category !== "premade")
    .map((v): TtsVoice => {
      const french = v.verified_languages?.find((l) => l.language === "fr");
      const isFrench = !!french || v.labels?.language === "fr";
      return {
        voice_id: v.voice_id,
        name: v.name,
        display_name: voiceDisplayName(v.name),
        description: v.description ?? v.labels?.description ?? null,
        gender: v.labels?.gender ?? null,
        accent: french?.accent ?? v.labels?.accent ?? null,
        // Prefer the French sample when the voice has one
        preview_url: french?.preview_url ?? v.preview_url ?? null,
        is_french: isFrench,
      };
    })
    .sort((a, b) => Number(b.is_french) - Number(a.is_french) || a.name.localeCompare(b.name));

  voicesCache = { at: Date.now(), voices };
  return voices;
}

/** Voices offered to children: the French ones, or all of them if none is French. */
export async function selectableVoices(): Promise<TtsVoice[]> {
  const voices = await listVoices();
  const french = voices.filter((v) => v.is_french);
  return french.length ? french : voices;
}

export async function defaultVoiceId(): Promise<string | null> {
  if (process.env.ELEVENLABS_DEFAULT_VOICE_ID) return process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  return (await selectableVoices())[0]?.voice_id ?? null;
}

export async function voiceForProfile(profileId: string): Promise<string | null> {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { tts_voice_id: true },
  });
  return profile?.tts_voice_id || (await defaultVoiceId());
}

/** Random voice of the pool, avoiding the previous one when there is a choice. */
export function drawVoice<T extends { voice_id: string }>(
  pool: T[],
  previousId: string | null,
  random: () => number = Math.random
): T | null {
  const fresh = pool.filter((v) => v.voice_id !== previousId);
  const candidates = fresh.length ? fresh : pool;
  return candidates[Math.floor(random() * candidates.length)] ?? null;
}

/**
 * Voice reading a new training session. In "rotate" mode, a random voice among
 * the ones ticked in the profile (all French voices if none), never the one of
 * the previous session; in "fixed" mode, the profile's voice.
 */
export async function pickSessionVoice(
  profileId: string
): Promise<{ voice_id: string; name: string } | null> {
  if (!isTtsConfigured()) return null;
  const [profile, voices] = await Promise.all([
    prisma.profiles.findUnique({
      where: { id: profileId },
      select: { tts_voice_id: true, tts_voice_mode: true, tts_voice_ids: true },
    }),
    selectableVoices(),
  ]);
  const byId = (id: string | null | undefined) => voices.find((v) => v.voice_id === id);
  const named = (v: TtsVoice) => ({ voice_id: v.voice_id, name: v.display_name });

  if (profile?.tts_voice_mode === "rotate") {
    const allowed = profile.tts_voice_ids.length
      ? voices.filter((v) => profile.tts_voice_ids.includes(v.voice_id))
      : voices;
    const pool = allowed.length ? allowed : voices;
    const previous = await prisma.training_session.findFirst({
      where: { profile_id: profileId, tts_voice_id: { not: null } },
      orderBy: { started_at: "desc" },
      select: { tts_voice_id: true },
    });
    const chosen = drawVoice(pool, previous?.tts_voice_id ?? null);
    return chosen ? named(chosen) : null;
  }

  const fixed = byId(profile?.tts_voice_id) ?? byId(await defaultVoiceId());
  if (fixed) return named(fixed);
  const id = profile?.tts_voice_id || (await defaultVoiceId());
  return id ? { voice_id: id, name: "" } : null;
}

// ---------------------------------------------------------------------------
// Synthesis with cache
// ---------------------------------------------------------------------------

export function audioUrl(hash: string) {
  return `/api/tts/audio/${hash}.mp3`;
}

/** Returns the URL of the cached mp3, generating it with ElevenLabs if needed. */
export async function speak(text: string, voiceId: string, profileId: string | null) {
  const clean = cleanTextForSpeech(text).slice(0, TTS_MAX_CHARS);
  if (!clean) throw new Error("Texte vide");
  const hash = createHash("sha256").update(`${TTS_MODEL_ID}|${voiceId}|${clean}`).digest("hex");

  const cached = await prisma.tts_audio.findUnique({ where: { hash } });
  if (cached) return { url: audioUrl(hash), cached: true };

  const res = await fetch(
    `${API}/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text: clean, model_id: TTS_MODEL_ID, language_code: "fr" }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 402) throw new TtsPlanError(`ElevenLabs TTS: 402 ${detail}`);
    throw new Error(`ElevenLabs TTS: ${res.status} ${detail}`);
  }
  const audio = Buffer.from(await res.arrayBuffer());

  const filePath = `tts/${hash}.mp3`;
  const supabase = await createClient(await cookies());
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, audio, { contentType: "audio/mpeg", upsert: true });
  if (error) throw new Error(`Supabase upload: ${error.message}`);

  // Two clicks at the same time may both generate: the unique hash keeps one row
  await prisma.tts_audio.upsert({
    where: { hash },
    create: {
      hash,
      voice_id: voiceId,
      model_id: TTS_MODEL_ID,
      characters: clean.length,
      file_path: filePath,
      profile_id: profileId,
    },
    update: {},
  });

  return { url: audioUrl(hash), cached: false };
}

export async function downloadAudio(hash: string) {
  const supabase = await createClient(await cookies());
  const { data, error } = await supabase.storage.from(BUCKET).download(`tts/${hash}.mp3`);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
