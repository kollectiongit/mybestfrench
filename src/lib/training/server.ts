import { prisma } from "@/lib/prisma";
import { Prisma } from "../../../app/generated/prisma";
import { pickSessionVoice } from "@/lib/tts";
import { generateReport, generateRetryExercise, generateSession, TaxonomyEntry } from "./ai";
import {
  exerciseSkillIds,
  exerciseTexts,
  itemKeys,
  normalizeExercise,
  toPublicPayload,
  unitCount,
} from "./exercises";
import {
  ExerciseHint,
  ExercisePayload,
  ItemResult,
  Lesson,
  SessionReport,
  Skill,
  SkillsResult,
} from "./schema";

export const EXERCISES_PER_SESSION = 5;
/** An exercise can be redone (new questions) when fewer than half of the answers are right. */
export const RETRY_THRESHOLD = 0.5;
/** Max redos of one original exercise. */
export const MAX_RETRIES = 2;

export async function getTaxonomy(): Promise<TaxonomyEntry[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { topic: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
  });
  return categories.map((c) => ({ id: c.id, name: c.name, topics: c.topic }));
}

export async function getProfileContext(profileId: string) {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    include: { profile_levels: { include: { levels: true } } },
  });
  const levels = (profile?.profile_levels ?? [])
    .map((pl) => pl.levels)
    .sort((a, b) => a.rank - b.rank);
  return {
    firstName: profile?.first_name ?? "l'élève",
    age: profile?.age ?? null,
    levelLabel: levels.length ? levels.map((l) => l.label).join(", ") : null,
  };
}

export function addSkillUnits(target: SkillsResult, result: ItemResult) {
  for (const unit of result.units) {
    const s = (target[unit.skill_id] ??= { correct: 0, total: 0 });
    s.total += 1;
    if (unit.correct) s.correct += 1;
  }
}

/** Sums skills over the profile's completed sessions of a sheet. */
export async function getMastery(sheetId: number, profileId: string): Promise<SkillsResult> {
  const sessions = await prisma.training_session.findMany({
    where: { sheet_id: sheetId, profile_id: profileId, status: "completed" },
    select: { skills_result: true },
  });
  const mastery: SkillsResult = {};
  for (const s of sessions) {
    for (const [id, score] of Object.entries((s.skills_result ?? {}) as unknown as SkillsResult)) {
      const m = (mastery[id] ??= { correct: 0, total: 0 });
      m.correct += score.correct;
      m.total += score.total;
    }
  }
  return mastery;
}

/** Creates a session and generates all its exercises upfront. */
export async function createSession(opts: {
  sheetId: number;
  profileId: string;
  userId: string;
}) {
  const sheet = await prisma.training_sheet.findFirst({
    where: { id: opts.sheetId, user_id: opts.userId },
    include: { topic: { include: { category: true } } },
  });
  if (!sheet) return null;

  const skills = sheet.skills_json as unknown as Skill[];
  const [student, mastery, previous] = await Promise.all([
    getProfileContext(opts.profileId),
    getMastery(sheet.id, opts.profileId),
    prisma.training_session.findMany({
      where: { sheet_id: sheet.id, profile_id: opts.profileId },
      orderBy: { started_at: "desc" },
      take: 6,
      select: { report_json: true, exercises: { select: { payload: true } } },
    }),
  ]);

  const previousAdvice = previous
    .map((p) => p.report_json as SessionReport | null)
    .filter((r): r is SessionReport => !!r)
    .slice(0, 3)
    .flatMap((r) => [...r.a_revoir, r.conseil])
    .filter(Boolean);
  const usedSentences = previous.flatMap((p) =>
    p.exercises.flatMap((e) => exerciseTexts(e.payload as unknown as ExercisePayload))
  );

  const { gen, model } = await generateSession({
    title: sheet.title,
    categoryName: sheet.topic.category.name,
    topicName: sheet.topic.name,
    lesson: sheet.lesson_json as unknown as Lesson,
    skills,
    hints: (sheet.exercise_hints ?? []) as unknown as ExerciseHint[],
    sourceText: sheet.source_text,
    student,
    mastery,
    previousAdvice,
    usedSentences,
    exerciseCount: EXERCISES_PER_SESSION,
  });

  // One voice per session (rotation set in the profile); speech is optional
  const voice = await pickSessionVoice(opts.profileId).catch((error) => {
    console.error("Error picking session voice:", error);
    return null;
  });

  const skillIds = new Set(skills.map((s) => s.id));
  const payloads = gen.exercises
    .map((e) => normalizeExercise(e, skillIds))
    .filter((p): p is ExercisePayload => p !== null);
  if (payloads.length === 0) throw new Error("Aucun exercice valide généré");

  return prisma.training_session.create({
    data: {
      sheet_id: sheet.id,
      profile_id: opts.profileId,
      user_id: opts.userId,
      model_name: model,
      tts_voice_id: voice?.voice_id ?? null,
      tts_voice_name: voice?.name || null,
      plan_json: {
        intro_message: gen.intro_message,
        focus_skill_ids: gen.focus_skill_ids.filter((id) => skillIds.has(id)),
      },
      items_total: payloads.reduce((n, p) => n + unitCount(p), 0),
      exercises: {
        create: payloads.map((payload, i) => ({
          position: i + 1,
          type: payload.type,
          skill_ids: exerciseSkillIds(payload),
          payload: payload as unknown as Prisma.InputJsonValue,
          items_total: unitCount(payload),
        })),
      },
    },
    select: { id: true },
  });
}

export async function findOwnedSession(sessionId: string, userId: string, profileId: string) {
  return prisma.training_session.findFirst({
    where: { id: sessionId, user_id: userId, profile_id: profileId },
    include: {
      sheet: { include: { topic: { include: { category: true } } } },
      exercises: { orderBy: { position: "asc" }, include: { answers: true } },
    },
  });
}

type OwnedSession = NonNullable<Awaited<ReturnType<typeof findOwnedSession>>>;

/** Client view of a session: exercises without answer keys + graded answers. */
export function serializeSession(session: OwnedSession) {
  return {
    id: session.id,
    status: session.status,
    started_at: session.started_at,
    completed_at: session.completed_at,
    active_seconds: session.active_seconds,
    score_20: session.score_20 == null ? null : Number(session.score_20),
    items_total: session.items_total,
    items_correct: session.items_correct,
    plan: session.plan_json as { intro_message: string; focus_skill_ids: string[] } | null,
    report: session.report_json as SessionReport | null,
    skills_result: session.skills_result as SkillsResult | null,
    voice_name: session.tts_voice_name,
    sheet: {
      id: session.sheet.id,
      title: session.sheet.title,
      category: session.sheet.topic.category.name,
      topic: session.sheet.topic.name,
      lesson: session.sheet.lesson_json as unknown as Lesson,
      skills: session.sheet.skills_json as unknown as Skill[],
    },
    exercises: session.exercises.map((e) => {
      const payload = e.payload as unknown as ExercisePayload;
      return {
        id: e.id,
        position: e.position,
        type: e.type,
        status: e.status,
        retry_of: e.retry_of,
        can_retry: session.status === "in_progress" && canRetry(e, session.exercises),
        items_total: e.items_total,
        items_correct: e.items_correct,
        item_keys: itemKeys(payload),
        payload: toPublicPayload(payload),
        answers: Object.fromEntries(
          e.answers.map((a) => [a.item_key, { answer: a.answer, result: a.result as unknown as ItemResult }])
        ),
      };
    }),
  };
}

export type SerializedSession = ReturnType<typeof serializeSession>;

type ExerciseRow = { id: number; status: string; items_total: number; items_correct: number; retry_of: number | null };

/** The first exercise of a chain of redos. */
function originalOf(e: ExerciseRow, all: ExerciseRow[]): number {
  const parent = all.find((x) => x.id === e.retry_of);
  return parent ? originalOf(parent, all) : e.id;
}

function canRetry(e: ExerciseRow, all: ExerciseRow[]) {
  if (e.status !== "done" || e.items_total === 0) return false;
  if (e.items_correct / e.items_total >= RETRY_THRESHOLD) return false;
  if (all.some((x) => x.retry_of === e.id)) return false; // already redone
  const original = originalOf(e, all);
  const redos = all.filter((x) => x.retry_of != null && originalOf(x, all) === original).length;
  return redos < MAX_RETRIES;
}

/**
 * Inserts a new attempt right after a failed exercise: new questions from the
 * AI (same format and skills), or the same questions if the AI fails.
 */
export async function retryExercise(exerciseId: number, userId: string, profileId: string) {
  const exercise = await prisma.training_exercise.findFirst({
    where: { id: exerciseId, session: { user_id: userId, profile_id: profileId, status: "in_progress" } },
    include: {
      answers: true,
      session: {
        include: {
          sheet: true,
          exercises: { select: { id: true, status: true, items_total: true, items_correct: true, retry_of: true } },
        },
      },
    },
  });
  if (!exercise) return null;
  const existing = exercise.session.exercises.find((x) => x.retry_of === exercise.id);
  if (existing) return existing.id;
  if (!canRetry(exercise, exercise.session.exercises)) return null;

  const original = exercise.payload as unknown as ExercisePayload;
  const skills = exercise.session.sheet.skills_json as unknown as Skill[];
  let payload: ExercisePayload = original;
  try {
    const gen = await generateRetryExercise({
      title: exercise.session.sheet.title,
      lesson: exercise.session.sheet.lesson_json as unknown as Lesson,
      skills,
      student: await getProfileContext(profileId),
      original: {
        type: original.type,
        title: original.title,
        instruction: original.instruction,
        texts: exerciseTexts(original),
      },
      mistakes: exercise.answers.flatMap((a) =>
        describeMistake(original, a.item_key, a.result as unknown as ItemResult)
      ),
    });
    const normalized = gen.type === original.type ? normalizeExercise(gen, new Set(skills.map((s) => s.id))) : null;
    if (normalized) payload = normalized;
  } catch (error) {
    // Same questions again rather than nothing
    console.error("Error generating retry exercise:", error);
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.training_exercise.updateMany({
      where: { session_id: exercise.session_id, position: { gt: exercise.position } },
      data: { position: { increment: 1 } },
    });
    const row = await tx.training_exercise.create({
      data: {
        session_id: exercise.session_id,
        position: exercise.position + 1,
        type: payload.type,
        is_remediation: true,
        retry_of: exercise.id,
        skill_ids: exerciseSkillIds(payload),
        payload: payload as unknown as Prisma.InputJsonValue,
        items_total: unitCount(payload),
      },
    });
    await tx.training_session.update({
      where: { id: exercise.session_id },
      data: { items_total: { increment: unitCount(payload) } },
    });
    return row;
  });
  return created.id;
}

/**
 * Called after an answer is stored. Recomputes the exercise counters and, once
 * every item is answered, marks it done and logs it in exercices_attempts so
 * it counts like one dictation in the stats.
 */
export async function refreshExercise(exerciseId: number, userId: string, profileId: string) {
  const exercise = await prisma.training_exercise.findUniqueOrThrow({
    where: { id: exerciseId },
    include: { answers: true },
  });
  const payload = exercise.payload as unknown as ExercisePayload;
  const keys = itemKeys(payload);
  const total = exercise.answers.reduce((n, a) => n + a.units_total, 0)
    + unitCount(payload) - answeredBaseUnits(payload, exercise.answers.map((a) => a.item_key));
  const correct = exercise.answers.reduce((n, a) => n + a.units_correct, 0);
  const done = keys.every((k) => exercise.answers.some((a) => a.item_key === k));

  const updated = await prisma.training_exercise.update({
    where: { id: exerciseId },
    data: {
      items_total: total,
      items_correct: correct,
      ...(done && exercise.status !== "done"
        ? { status: "done", completed_at: new Date() }
        : {}),
    },
  });

  if (done && exercise.status !== "done") {
    await prisma.exercices_attempts.create({
      data: {
        user_id: userId,
        profile_id: profileId,
        training_exercise_id: exerciseId,
        question_type: "SESSION",
        question_text: payload.title,
        is_correct: correct === total,
        correction_success_percentage: total ? Math.round((correct / total) * 100) : 0,
      },
    });
  }

  // Keep session totals in sync (extras in mark_words can raise the total)
  const all = await prisma.training_exercise.findMany({
    where: { session_id: exercise.session_id },
    select: { items_total: true, items_correct: true },
  });
  await prisma.training_session.update({
    where: { id: exercise.session_id },
    data: {
      items_total: all.reduce((n, e) => n + e.items_total, 0),
      items_correct: all.reduce((n, e) => n + e.items_correct, 0),
    },
  });

  return updated;
}

/** Base units (before grading) held by the items already answered. */
function answeredBaseUnits(payload: ExercisePayload, answeredKeys: string[]) {
  const answered = new Set(answeredKeys);
  switch (payload.type) {
    case "choice":
      return payload.questions.filter((q) => answered.has(q.id)).length;
    case "fill_blanks":
      return payload.sentences.filter((s) => answered.has(s.id)).reduce((n, s) => n + s.blanks.length, 0);
    case "mark_words":
      return payload.sentences.filter((s) => answered.has(s.id)).reduce((n, s) => n + s.targets.length, 0);
    case "classify":
      return answered.has("all") ? payload.items.length : 0;
    case "label":
    case "rewrite":
    case "short_answer":
      return payload.items.filter((i) => answered.has(i.id)).length;
  }
}

function describeMistake(payload: ExercisePayload, itemKey: string, result: ItemResult): string[] {
  switch (result.kind) {
    case "choice": {
      if (result.is_correct || payload.type !== "choice") return [];
      const q = payload.questions.find((q) => q.id === itemKey);
      const opts = q?.options ?? [];
      return [
        `${q?.prompt ?? "QCM"} — répondu « ${result.selected.map((i) => opts[i]).join(", ")} » au lieu de « ${result.correct.map((i) => opts[i]).join(", ")} »`,
      ];
    }
    case "fill_blanks":
      return result.blanks
        .filter((b) => !b.correct)
        .map((b) => `Trou : écrit « ${b.given || "(vide)"} » au lieu de « ${b.expected} »`);
    case "mark_words":
      return [
        ...result.targets.filter((t) => !t.correct).map((t) => `Pas trouvé « ${t.text} » (${t.key})`),
        ...(result.extras.length ? [`${result.extras.length} mot(s) marqué(s) en trop`] : []),
      ];
    case "classify":
    case "label": {
      const items = payload.type === "classify" || payload.type === "label" ? payload.items : [];
      return result.items
        .filter((i) => !i.correct)
        .map((i) => {
          const text = items.find((it) => it.id === i.id)?.text ?? i.id;
          return `« ${text} » : choisi ${i.given ?? "rien"} au lieu de ${i.expected}`;
        });
    }
    case "open": {
      if (result.correct) return [];
      const prompt =
        payload.type === "rewrite" || payload.type === "short_answer"
          ? payload.items.find((i) => i.id === itemKey)?.prompt
          : undefined;
      return [`${prompt ?? "Question"} — écrit « ${result.given} » au lieu de « ${result.expected} »`];
    }
  }
}

export async function completeSession(sessionId: string, userId: string, profileId: string) {
  const session = await findOwnedSession(sessionId, userId, profileId);
  if (!session) return null;
  if (session.status === "completed") return session;

  const skillsResult: SkillsResult = {};
  const mistakes: string[] = [];
  let total = 0;
  let correct = 0;
  for (const e of session.exercises) {
    const payload = e.payload as unknown as ExercisePayload;
    total += e.items_total;
    correct += e.items_correct;
    for (const a of e.answers) {
      const result = a.result as unknown as ItemResult;
      addSkillUnits(skillsResult, result);
      mistakes.push(...describeMistake(payload, a.item_key, result));
    }
  }
  const score20 = total ? Math.round((correct / total) * 200) / 10 : 0;
  const skills = session.sheet.skills_json as unknown as Skill[];
  const labelOf = (id: string) => skills.find((s) => s.id === id)?.label ?? "Divers";

  const student = await getProfileContext(profileId);
  let reportGen;
  try {
    reportGen = await generateReport({
      firstName: student.firstName,
      title: session.sheet.title,
      score20,
      skills: Object.entries(skillsResult).map(([id, s]) => ({ label: labelOf(id), ...s })),
      mistakes,
    });
  } catch (error) {
    console.error("Error generating session report:", error);
    const entries = Object.entries(skillsResult);
    reportGen = {
      compris: entries.filter(([, s]) => s.correct / s.total >= 0.8).map(([id]) => labelOf(id)),
      a_revoir: entries.filter(([, s]) => s.correct / s.total < 0.8).map(([id]) => labelOf(id)),
      message: score20 >= 14 ? "Très beau travail !" : "Continue tes efforts, tu progresses !",
      conseil: "Relis la leçon avant la prochaine session.",
    };
  }

  const report: SessionReport = {
    ...reportGen,
    score_20: score20,
    items_correct: correct,
    items_total: total,
    active_seconds: session.active_seconds,
  };

  await prisma.training_session.update({
    where: { id: session.id },
    data: {
      status: "completed",
      completed_at: new Date(),
      score_20: score20,
      items_total: total,
      items_correct: correct,
      skills_result: skillsResult as unknown as Prisma.InputJsonValue,
      report_json: report as unknown as Prisma.InputJsonValue,
    },
  });

  return findOwnedSession(sessionId, userId, profileId);
}
