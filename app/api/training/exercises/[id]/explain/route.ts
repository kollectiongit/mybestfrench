import { prisma } from "@/lib/prisma";
import { ExercisePayload, ItemResult, Lesson } from "@/lib/training/schema";
import { getProfileContext } from "@/lib/training/server";
import { ChatMessage, describeItem, streamTutorAnswer } from "@/lib/training/tutor";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 500;

// POST /api/training/exercises/[id]/explain  { item_key, messages }
// "Pourquoi ?" — the tutor explains an item the student already answered (streamed text).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const exerciseId = Number((await params).id);
    const body = await request.json();
    const itemKey = body.item_key?.toString();
    const messages: ChatMessage[] = (Array.isArray(body.messages) ? body.messages : [])
      .filter(
        (m: ChatMessage) =>
          (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim()
      )
      .slice(-MAX_MESSAGES)
      .map((m: ChatMessage) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
    if (!itemKey || messages.length === 0 || messages[messages.length - 1].role !== "user") {
      return NextResponse.json({ error: "Question manquante" }, { status: 400 });
    }

    const exercise = await prisma.training_exercise.findFirst({
      where: {
        id: exerciseId,
        session: { user_id: resolved.session.user.id, profile_id: resolved.profileId },
      },
      include: {
        session: { include: { sheet: { select: { lesson_json: true } } } },
        answers: { where: { item_key: itemKey } },
      },
    });
    if (!exercise) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    // Only after answering, so the tutor never gives the answer away
    const answer = exercise.answers[0];
    if (!answer) {
      return NextResponse.json({ error: "Réponds d'abord à la question" }, { status: 400 });
    }

    const payload = exercise.payload as unknown as ExercisePayload;
    const student = await getProfileContext(resolved.profileId);
    const stream = streamTutorAnswer({
      firstName: student.firstName,
      levelLabel: student.levelLabel,
      lesson: exercise.session.sheet.lesson_json as unknown as Lesson,
      instruction: payload.instruction,
      itemContext: describeItem(payload, itemKey, answer.result as unknown as ItemResult),
      messages,
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error explaining training item:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
