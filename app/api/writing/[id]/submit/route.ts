import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { correctWriting } from "@/lib/writing/ai";
import { Correction } from "@/lib/writing/schema";
import {
  averageDictationWords,
  buildSegments,
  findOwnedProject,
  getStudentContext,
  MAX_TEXT_LENGTH,
  serializeAttempt,
} from "@/lib/writing/server";
import { countWords, dicteeValue } from "@/lib/writing/words";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "../../../../generated/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/writing/[id]/submit  { text, active_seconds } - Hand in an attempt:
// the AI corrects it and the attempt is saved with its scores.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });
    if (!project.outline) return NextResponse.json({ error: "Valide d'abord ta trame" }, { status: 400 });

    const body = await request.json();
    const text = (typeof body.text === "string" ? body.text : "").trim().slice(0, MAX_TEXT_LENGTH);
    const wordCount = countWords(text);
    if (wordCount < project.min_words) {
      return NextResponse.json(
        { error: `Encore ${project.min_words - wordCount} mots pour atteindre ton objectif` },
        { status: 400 }
      );
    }
    const activeSeconds = Number.isFinite(body.active_seconds)
      ? Math.min(Math.max(0, Math.round(body.active_seconds)), 24 * 3600)
      : project.draft_active_seconds;

    const [student, averageWords] = await Promise.all([
      getStudentContext(resolved.profileId, project.id),
      averageDictationWords(resolved.profileId),
    ]);
    const { correction, model } = await correctWriting({
      student,
      outline: project.outline,
      text,
      wordCount,
      minWords: project.min_words,
      previousScores: project.attempts.map((a) => a.score_global),
    });

    const { scores, ...rest } = correction;
    const stored: Correction = { ...rest, segments: buildSegments(text, correction.errors) };
    const number = (project.attempts.at(-1)?.number ?? 0) + 1;

    const [attempt] = await prisma.$transaction([
      prisma.writing_attempt.create({
        data: {
          project_id: project.id,
          profile_id: resolved.profileId,
          number,
          text,
          word_count: wordCount,
          min_words: project.min_words,
          outline_snapshot: project.outline,
          active_seconds: activeSeconds,
          score_global: scores.global,
          score_spelling: scores.spelling,
          score_grammar: scores.grammar,
          score_conjugation: scores.conjugation,
          score_vocabulary: scores.vocabulary,
          correction_json: stored as unknown as Prisma.InputJsonValue,
          corrected_text: correction.corrected_text,
          improved_text: correction.improved_text,
          dictee_value: dicteeValue(wordCount, averageWords),
          model_name: model,
        },
      }),
      // The next attempt starts from a blank page
      prisma.writing_project.update({
        where: { id: project.id },
        data: { draft_text: "", draft_updated_at: new Date(), draft_active_seconds: 0 },
      }),
    ]);

    return NextResponse.json({ attempt: serializeAttempt(attempt) });
  } catch (error) {
    console.error("Error correcting writing:", error);
    return NextResponse.json(
      { error: "La correction a échoué, ton texte est gardé : réessaie dans un instant" },
      { status: 500 }
    );
  }
}
