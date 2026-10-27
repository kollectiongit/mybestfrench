import { prisma } from "@/lib/prisma";
import { analyzeSource } from "@/lib/training/ai";
import { createSession, getTaxonomy } from "@/lib/training/server";
import { uniqueCategorySlug, uniqueTopicSlug } from "@/lib/training/taxonomy";
import { cleanTextForSpeech, isTtsConfigured, speak, TTS_MAX_CHARS, voiceForProfile } from "@/lib/tts";
import { createHash } from "crypto";
import { Prisma } from "../../../app/generated/prisma";
import type { StudentContext } from "./ai";
import { ChatMessage, Correction, CorrectionGen, Segment } from "./schema";
import { DEFAULT_DICTATION_WORDS, splitSentences } from "./words";

export const MIN_WORDS_LIMITS = { min: 20, max: 2000 };
export const MAX_CHAT_MESSAGES = 60;
export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_TEXT_LENGTH = 20000;

export function clampMinWords(value: unknown, fallback: number) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MIN_WORDS_LIMITS.max, Math.max(MIN_WORDS_LIMITS.min, n));
}

export async function getStudentContext(profileId: string, excludeProjectId?: string): Promise<StudentContext> {
  const [profile, projects] = await Promise.all([
    prisma.profiles.findUnique({
      where: { id: profileId },
      include: {
        profile_levels: { include: { levels: true } },
        books: { orderBy: { updated_at: "desc" }, take: 8, select: { title: true } },
      },
    }),
    prisma.writing_project.findMany({
      where: { profile_id: profileId, title: { not: null }, id: excludeProjectId ? { not: excludeProjectId } : undefined },
      orderBy: { created_at: "desc" },
      take: 10,
      select: { title: true },
    }),
  ]);
  const levels = (profile?.profile_levels ?? []).map((pl) => pl.levels).sort((a, b) => a.rank - b.rank);
  return {
    firstName: profile?.first_name ?? "l'élève",
    age: profile?.age ?? null,
    levelLabel: levels.length ? levels.map((l) => l.label).join(", ") : null,
    description: profile?.description?.trim() || null,
    books: (profile?.books ?? []).map((b) => b.title),
    movies: profile?.favorite_movies?.trim() || null,
    news: profile?.news_interests?.trim() || null,
    previousTopics: projects.map((p) => p.title!).filter(Boolean),
  };
}

/** Average length of the dictées of the student's levels (all dictées if none). */
export async function averageDictationWords(profileId: string) {
  const levels = await prisma.profile_levels.findMany({
    where: { profile_id: profileId },
    select: { level_id: true },
  });
  const levelIds = levels.map((l) => l.level_id);
  const atLevel = levelIds.length
    ? await prisma.dictation.aggregate({
        where: { count_words: { gt: 0 }, dictations_levels: { some: { level_id: { in: levelIds } } } },
        _avg: { count_words: true },
      })
    : null;
  const average =
    atLevel?._avg.count_words ??
    (await prisma.dictation.aggregate({ where: { count_words: { gt: 0 } }, _avg: { count_words: true } }))._avg
      .count_words;
  return Math.round(average ?? DEFAULT_DICTATION_WORDS);
}

export function sanitizeMessages(raw: unknown): ChatMessage[] {
  return (Array.isArray(raw) ? raw : [])
    .filter(
      (m): m is ChatMessage =>
        (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && !!m.content.trim()
    )
    .slice(-MAX_CHAT_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
}

export function findOwnedProject(id: string, userId: string, profileId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Promise.resolve(null);
  return prisma.writing_project.findFirst({
    where: { id, user_id: userId, profile_id: profileId },
    include: { attempts: { orderBy: { number: "asc" } } },
  });
}

type OwnedProject = NonNullable<Awaited<ReturnType<typeof findOwnedProject>>>;

export function serializeAttempt(a: OwnedProject["attempts"][number]) {
  return {
    id: a.id,
    number: a.number,
    text: a.text,
    word_count: a.word_count,
    min_words: a.min_words,
    outline_snapshot: a.outline_snapshot,
    active_seconds: a.active_seconds,
    scores: {
      global: a.score_global,
      spelling: a.score_spelling,
      grammar: a.score_grammar,
      conjugation: a.score_conjugation,
      vocabulary: a.score_vocabulary,
    },
    correction: a.correction_json as unknown as Correction,
    corrected_text: a.corrected_text,
    improved_text: a.improved_text,
    dictee_value: Number(a.dictee_value),
    training_sheets: (a.training_sheets ?? {}) as Record<string, number>,
    created_at: a.created_at.toISOString(),
  };
}

export function serializeProject(p: OwnedProject) {
  return {
    id: p.id,
    title: p.title,
    status: p.status as "planning" | "writing",
    chat: (p.chat_json ?? []) as unknown as ChatMessage[],
    outline: p.outline,
    outline_validated_at: p.outline_validated_at?.toISOString() ?? null,
    min_words: p.min_words,
    draft_text: p.draft_text,
    draft_updated_at: p.draft_updated_at?.toISOString() ?? null,
    draft_active_seconds: p.draft_active_seconds,
    created_at: p.created_at.toISOString(),
    attempts: p.attempts.map(serializeAttempt),
  };
}
export type SerializedProject = ReturnType<typeof serializeProject>;
export type SerializedAttempt = ReturnType<typeof serializeAttempt>;

// ---------------------------------------------------------------------------
// Correction: locate the errors in the student's text
// ---------------------------------------------------------------------------

/**
 * Splits the text around each error the AI quoted. An error is looked up after
 * the previous one (with its context first, to pick the right occurrence);
 * errors that cannot be found stay listed but are not highlighted.
 */
export function buildSegments(text: string, errors: CorrectionGen["errors"]): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  errors.forEach((error, index) => {
    if (!error.wrong) return;
    let at = -1;
    if (error.context_before.trim()) {
      const withContext = text.indexOf(`${error.context_before}${error.context_before.endsWith(" ") ? "" : " "}${error.wrong}`, cursor);
      if (withContext >= 0) at = text.indexOf(error.wrong, withContext + error.context_before.length);
    }
    if (at < 0) at = text.indexOf(error.wrong, cursor);
    if (at < 0) return;
    if (at > cursor) segments.push({ text: text.slice(cursor, at), error: null });
    segments.push({ text: error.wrong, error: index });
    cursor = at + error.wrong.length;
  });
  if (cursor < text.length) segments.push({ text: text.slice(cursor), error: null });
  return segments;
}

// ---------------------------------------------------------------------------
// Outline read aloud: generated once per outline text, then reused
// ---------------------------------------------------------------------------

/** Pieces short enough for one ElevenLabs request, cut between sentences. */
export function speechChunks(text: string, max = TTS_MAX_CHARS - 100) {
  // Each line of the outline becomes a sentence; list markers are not read
  const lines = cleanTextForSpeech(
    text
      .replace(/^\s*(?:[-•]|\d+[.)])\s*/gm, "")
      .replace(/([^.!?:…])\s*\n+/g, "$1. ")
      .replace(/\n+/g, " ")
  );
  const chunks: string[] = [];
  let current = "";
  for (const sentence of splitSentences(lines)) {
    const piece = sentence.length > max ? sentence.slice(0, max) : sentence;
    if (current && current.length + piece.length + 1 > max) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current} ${piece}` : piece;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function outlineAudio(project: { id: string; outline: string | null; outline_audio_hash: string | null; outline_audio_urls: string[] }, profileId: string) {
  const outline = project.outline?.trim();
  if (!outline) return null;

  const profile = await prisma.profiles.findUnique({ where: { id: profileId }, select: { tts_voice_mode: true } });
  if (!isTtsConfigured() || profile?.tts_voice_mode === "device") {
    return { engine: "device" as const, texts: speechChunks(outline) };
  }

  const voiceId = await voiceForProfile(profileId);
  if (!voiceId) return { engine: "device" as const, texts: speechChunks(outline) };
  const hash = createHash("sha256").update(`${voiceId}|${outline}`).digest("hex");
  if (project.outline_audio_hash === hash && project.outline_audio_urls.length) {
    return { engine: "elevenlabs" as const, urls: project.outline_audio_urls };
  }

  const urls: string[] = [];
  for (const chunk of speechChunks(outline)) urls.push((await speak(chunk, voiceId, profileId)).url);
  await prisma.writing_project.update({
    where: { id: project.id },
    data: { outline_audio_hash: hash, outline_audio_urls: urls },
  });
  return { engine: "elevenlabs" as const, urls };
}

// ---------------------------------------------------------------------------
// Practice exercises on a point to work on (reuses the training sessions)
// ---------------------------------------------------------------------------

async function resolveTopic(analysis: Awaited<ReturnType<typeof analyzeSource>>, taxonomy: Awaited<ReturnType<typeof getTaxonomy>>) {
  const category = taxonomy.find((c) => c.id === analysis.category.existing_id);
  const topic = category?.topics.find((t) => t.id === analysis.topic.existing_id);
  if (topic) return topic.id;

  let categoryId = category?.id;
  if (!categoryId) {
    const name = analysis.category.new_name?.trim() || "Orthographe";
    const existing = await prisma.category.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    categoryId =
      existing?.id ?? (await prisma.category.create({ data: { name, slug: await uniqueCategorySlug(name) } })).id;
  }
  const topicName = analysis.topic.new_name?.trim() || analysis.title;
  const existingTopic = await prisma.topic.findFirst({
    where: { category_id: categoryId, name: { equals: topicName, mode: "insensitive" } },
  });
  return (
    existingTopic?.id ??
    (await prisma.topic.create({
      data: { category_id: categoryId, name: topicName, slug: await uniqueTopicSlug(topicName) },
    })).id
  );
}

/**
 * Starts a training session on one point to work on of an attempt. The
 * training sheet is created on the first click, then reused.
 */
export async function startPractice(opts: {
  attemptId: number;
  index: number;
  userId: string;
  profileId: string;
  levelLabel: string | null;
}) {
  const attempt = await prisma.writing_attempt.findFirst({
    where: { id: opts.attemptId, profile_id: opts.profileId, project: { user_id: opts.userId } },
  });
  if (!attempt) return null;
  const correction = attempt.correction_json as unknown as Correction;
  const point = correction.to_work?.[opts.index];
  if (!point) return null;

  const sheets = (attempt.training_sheets ?? {}) as Record<string, number>;
  let sheetId = sheets[String(opts.index)];
  const exists = sheetId
    ? await prisma.training_sheet.findFirst({ where: { id: sheetId, user_id: opts.userId, archived: false } })
    : null;

  if (!exists) {
    const errors = correction.errors
      .map((e) => `- « ${e.wrong} » au lieu de « ${e.correction} » (${e.type}) : ${e.explanation}`)
      .join("\n");
    const sourceText = `Exercices pour s'entraîner sur ce point, travaillé après une expression écrite : ${point.label}.
${point.details}

Erreurs faites par l'élève dans sa copie :
${errors || "(aucune)"}

Concentre la fiche sur ce point uniquement et reprends des phrases proches de celles de l'élève.`;
    const taxonomy = await getTaxonomy();
    const analysis = await analyzeSource({ images: [], text: sourceText, taxonomy, levelLabel: opts.levelLabel });
    const topicId = await resolveTopic(analysis, taxonomy);
    const sheet = await prisma.training_sheet.create({
      data: {
        user_id: opts.userId,
        topic_id: topicId,
        title: analysis.title.slice(0, 200),
        source_type: "text",
        source_text: sourceText,
        lesson_json: analysis.lesson as unknown as Prisma.InputJsonValue,
        skills_json: analysis.skills as unknown as Prisma.InputJsonValue,
        exercise_hints: analysis.exercise_hints as unknown as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    sheetId = sheet.id;
    await prisma.writing_attempt.update({
      where: { id: attempt.id },
      data: { training_sheets: { ...sheets, [String(opts.index)]: sheetId } },
    });
  }

  const session = await createSession({ sheetId, profileId: opts.profileId, userId: opts.userId });
  return session ? { sheetId, sessionId: session.id as string } : null;
}
