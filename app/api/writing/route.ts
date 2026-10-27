import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { clampMinWords } from "@/lib/writing/server";
import { countWords } from "@/lib/writing/words";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/writing - Expressions écrites of the current profile, most recent activity first
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const [profile, projects] = await Promise.all([
      prisma.profiles.findUnique({
        where: { id: resolved.profileId },
        select: { writing_min_words: true },
      }),
      prisma.writing_project.findMany({
        where: { profile_id: resolved.profileId, user_id: resolved.session.user.id, archived: false },
        orderBy: { updated_at: "desc" },
        include: {
          attempts: {
            orderBy: { number: "asc" },
            select: { number: true, score_global: true, word_count: true, dictee_value: true, created_at: true },
          },
        },
      }),
    ]);

    return NextResponse.json({
      default_min_words: profile?.writing_min_words ?? 100,
      projects: projects.map((p) => ({
        id: p.id,
        title: p.title,
        status: p.status,
        min_words: p.min_words,
        draft_words: countWords(p.draft_text),
        created_at: p.created_at,
        updated_at: p.updated_at,
        attempts: p.attempts.map((a) => ({
          number: a.number,
          score: a.score_global,
          word_count: a.word_count,
          dictee_value: Number(a.dictee_value),
          created_at: a.created_at,
        })),
      })),
    });
  } catch (error) {
    console.error("Error listing writing projects:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/writing  { min_words? } - Start a new expression écrite (word goal frozen here)
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const body = await request.json().catch(() => ({}));
    const profile = await prisma.profiles.findUnique({
      where: { id: resolved.profileId },
      select: { writing_min_words: true },
    });
    const project = await prisma.writing_project.create({
      data: {
        profile_id: resolved.profileId,
        user_id: resolved.session.user.id,
        min_words: clampMinWords(body.min_words, profile?.writing_min_words ?? 100),
      },
      select: { id: true },
    });
    return NextResponse.json({ project });
  } catch (error) {
    console.error("Error creating writing project:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
