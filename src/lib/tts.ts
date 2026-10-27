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
  description: string | null;
  gender: string | null;
  accent: string | null;
  preview_url: string | null;
  is_french: boolean;
}

interface ElevenVoice {
  voice_id: string;
  name: string;
  description?: string | null;
  preview_url?: string | null;
  labels?: Record<string, string>;
  verified_languages?: { language: string; accent?: string | null; preview_url?: string | null }[];
}

let voicesCache: { at: number; voices: TtsVoice[] } | null = null;
const VOICES_TTL_MS = 60 * 60 * 1000;

/** Voices of the ElevenLabs account ("My Voices"), French ones first. */
export async function listVoices(): Promise<TtsVoice[]> {
  if (voicesCache && Date.now() - voicesCache.at < VOICES_TTL_MS) return voicesCache.voices;

  const res = await fetch(`${API}/v2/voices?page_size=100`, {
    headers: { "xi-api-key": apiKey() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ElevenLabs voices: ${res.status}`);
  const data = (await res.json()) as { voices: ElevenVoice[] };

  const voices = data.voices
    .map((v): TtsVoice => {
      const french = v.verified_languages?.find((l) => l.language === "fr");
      const isFrench = !!french || v.labels?.language === "fr";
      return {
        voice_id: v.voice_id,
        name: v.name,
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

export async function defaultVoiceId(): Promise<string | null> {
  if (process.env.ELEVENLABS_DEFAULT_VOICE_ID) return process.env.ELEVENLABS_DEFAULT_VOICE_ID;
  const voices = await listVoices();
  return (voices.find((v) => v.is_french) ?? voices[0])?.voice_id ?? null;
}

export async function voiceForProfile(profileId: string): Promise<string | null> {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    select: { tts_voice_id: true },
  });
  return profile?.tts_voice_id || (await defaultVoiceId());
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
    throw new Error(`ElevenLabs TTS: ${res.status} ${await res.text().catch(() => "")}`);
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
