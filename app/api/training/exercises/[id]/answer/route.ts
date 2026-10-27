import { Prisma } from "../../../../../generated/prisma";
import { prisma } from "@/lib/prisma";
import { GradingError, gradeItem, itemKeys } from "@/lib/training/exercises";
import { ExercisePayload } from "@/lib/training/schema";
import { refreshExercise } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/training/exercises/[id]/answer  { item_key, answer }
// Grades one item deterministically; an item can only be answered once.
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

    const exercise = await prisma.training_exercise.findFirst({
      where: {
        id: exerciseId,
        session: {
          user_id: resolved.session.user.id,
          profile_id: resolved.profileId,
          status: "in_progress",
        },
      },
    });
    if (!exercise) return NextResponse.json({ error: "Exercice introuvable" }, { status: 404 });

    const payload = exercise.payload as unknown as ExercisePayload;
    if (!itemKey || !itemKeys(payload).includes(itemKey)) {
      return NextResponse.json({ error: "Question inconnue" }, { status: 400 });
    }

    const existing = await prisma.training_answer.findUnique({
      where: { exercise_id_item_key: { exercise_id: exerciseId, item_key: itemKey } },
    });
    if (existing) {
      return NextResponse.json({ error: "Tu as déjà répondu à cette question" }, { status: 409 });
    }

    let result;
    try {
      result = gradeItem(payload, itemKey, body.answer);
    } catch (error) {
      if (error instanceof GradingError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    await prisma.training_answer.create({
      data: {
        exercise_id: exerciseId,
        item_key: itemKey,
        answer: (body.answer ?? null) as Prisma.InputJsonValue,
        result: result as unknown as Prisma.InputJsonValue,
        units_total: result.units.length,
        units_correct: result.units.filter((u) => u.correct).length,
      },
    });

    const updated = await refreshExercise(
      exerciseId,
      resolved.session.user.id,
      resolved.profileId
    );

    return NextResponse.json({
      result,
      exercise: {
        id: updated.id,
        status: updated.status,
        items_total: updated.items_total,
        items_correct: updated.items_correct,
      },
    });
  } catch (error) {
    console.error("Error grading training answer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
