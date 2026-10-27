import { Prisma } from "../../../../generated/prisma";
import { prisma } from "@/lib/prisma";
import { LessonSchema, SkillSchema } from "@/lib/training/schema";
import { getMastery } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/training/sheets/[id] - Sheet, lesson, mastery and session history of the current profile
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const id = Number((await params).id);
    const sheet = await prisma.training_sheet.findFirst({
      where: { id, user_id: resolved.session.user.id },
      include: {
        topic: { include: { category: true } },
        sessions: {
          where: { profile_id: resolved.profileId },
          orderBy: { started_at: "desc" },
          select: {
            id: true,
            status: true,
            started_at: true,
            completed_at: true,
            active_seconds: true,
            score_20: true,
            items_total: true,
            items_correct: true,
          },
        },
      },
    });
    if (!sheet) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    const mastery = await getMastery(sheet.id, resolved.profileId);

    return NextResponse.json({
      sheet: {
        id: sheet.id,
        title: sheet.title,
        source_type: sheet.source_type,
        source_images: sheet.source_images,
        source_text: sheet.source_text,
        lesson: sheet.lesson_json,
        skills: sheet.skills_json,
        archived: sheet.archived,
        category: { id: sheet.topic.category.id, name: sheet.topic.category.name },
        topic: { id: sheet.topic.id, name: sheet.topic.name },
      },
      mastery,
      sessions: sheet.sessions.map((s) => ({
        ...s,
        score_20: s.score_20 == null ? null : Number(s.score_20),
      })),
    });
  } catch (error) {
    console.error("Error fetching training sheet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const UpdateSheetSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  topic_id: z.number().int().optional(),
  lesson: LessonSchema.optional(),
  skills: z.array(SkillSchema).min(1).optional(),
  archived: z.boolean().optional(),
});

// PATCH /api/training/sheets/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const id = Number((await params).id);
    const parsed = UpdateSheetSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Données invalides" }, { status: 400 });

    const owned = await prisma.training_sheet.findFirst({
      where: { id, user_id: resolved.session.user.id },
      select: { id: true },
    });
    if (!owned) return NextResponse.json({ error: "Fiche introuvable" }, { status: 404 });

    const { lesson, skills, ...rest } = parsed.data;
    await prisma.training_sheet.update({
      where: { id },
      data: {
        ...rest,
        ...(lesson ? { lesson_json: lesson as Prisma.InputJsonValue } : {}),
        ...(skills ? { skills_json: skills as Prisma.InputJsonValue } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error updating training sheet:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
