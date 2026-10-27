import { Prisma } from "../../../generated/prisma";
import { prisma } from "@/lib/prisma";
import { ExerciseHintSchema, LessonSchema, SkillSchema } from "@/lib/training/schema";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET /api/training/sheets - Sheets of the account with the current profile's last result
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const sheets = await prisma.training_sheet.findMany({
      where: { user_id: resolved.session.user.id, archived: false },
      orderBy: { updated_at: "desc" },
      include: {
        topic: { include: { category: true } },
        sessions: {
          where: { profile_id: resolved.profileId },
          orderBy: { started_at: "desc" },
          select: { id: true, status: true, score_20: true, started_at: true },
        },
      },
    });

    return NextResponse.json({
      sheets: sheets.map((s) => {
        const completed = s.sessions.filter((x) => x.status === "completed");
        const inProgress = s.sessions.find((x) => x.status === "in_progress");
        return {
          id: s.id,
          title: s.title,
          source_type: s.source_type,
          cover_image: s.source_images[0] ?? null,
          category: { id: s.topic.category.id, name: s.topic.category.name },
          topic: { id: s.topic.id, name: s.topic.name },
          sessions_count: completed.length,
          last_score: completed[0]?.score_20 == null ? null : Number(completed[0].score_20),
          best_score: completed.length
            ? Math.max(...completed.map((x) => Number(x.score_20 ?? 0)))
            : null,
          last_session_at: s.sessions[0]?.started_at ?? null,
          in_progress_session_id: inProgress?.id ?? null,
        };
      }),
    });
  } catch (error) {
    console.error("Error listing training sheets:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const CreateSheetSchema = z.object({
  title: z.string().trim().min(1).max(200),
  topic_id: z.number().int(),
  source_type: z.enum(["photo", "text"]),
  source_images: z.array(z.string()).max(4),
  source_text: z.string().nullable(),
  lesson: LessonSchema,
  skills: z.array(SkillSchema).min(1),
  exercise_hints: z.array(ExerciseHintSchema),
});

// POST /api/training/sheets
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const parsed = CreateSheetSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Fiche incomplète" }, { status: 400 });
    }
    const data = parsed.data;

    const topic = await prisma.topic.findUnique({ where: { id: data.topic_id } });
    if (!topic) return NextResponse.json({ error: "Thème introuvable" }, { status: 400 });

    const sheet = await prisma.training_sheet.create({
      data: {
        user_id: resolved.session.user.id,
        topic_id: data.topic_id,
        title: data.title,
        source_type: data.source_type,
        source_images: data.source_images.filter((p) => /^training_[\w.-]+$/.test(p)),
        source_text: data.source_text?.trim() || null,
        lesson_json: data.lesson as Prisma.InputJsonValue,
        skills_json: data.skills as Prisma.InputJsonValue,
        exercise_hints: data.exercise_hints as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    return NextResponse.json({ sheet });
  } catch (error) {
    console.error("Error creating training sheet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
