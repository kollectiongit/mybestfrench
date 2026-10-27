import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/topics/[id]  { name?, category_id? }
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number((await params).id);
    const body = await request.json();
    const data: { name?: string; category_id?: number } = {};
    if (body.name !== undefined) {
      const name = body.name?.toString().trim();
      if (!name) {
        return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
      }
      data.name = name;
    }
    if (body.category_id !== undefined) data.category_id = Number(body.category_id);

    const topic = await prisma.topic.update({ where: { id }, data });
    return NextResponse.json({ topic });
  } catch (error) {
    console.error("Error updating topic:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/topics/[id] - Only when no dictation, exercise or training sheet uses it
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = Number((await params).id);
    const [dictations, exercises, sheets] = await Promise.all([
      prisma.dictation.count({ where: { topic_id: id } }),
      prisma.exercises.count({ where: { topic_id: id } }),
      prisma.training_sheet.count({ where: { topic_id: id } }),
    ]);
    if (dictations + exercises + sheets > 0) {
      return NextResponse.json(
        { error: "Ce thème est utilisé par des dictées ou des fiches" },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.topics_levels.deleteMany({ where: { topic_id: id } }),
      prisma.topic.delete({ where: { id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error deleting topic:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
