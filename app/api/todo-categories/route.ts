import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/todo-categories?profile_id=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveProfileForRequest(
      request,
      searchParams.get("profile_id")
    );
    if ("error" in resolved) return resolved.error;

    const categories = await prisma.todo_categories.findMany({
      where: { profile_id: resolved.profileId },
      orderBy: { name: "asc" },
      include: { _count: { select: { todos: true } } },
    });

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        created_at: c.created_at,
        todos_count: c._count.todos,
      })),
    });
  } catch (error) {
    console.error("Error listing todo categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/todo-categories  { profile_id, name, icon? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resolved = await resolveProfileForRequest(request, body.profile_id);
    if ("error" in resolved) return resolved.error;

    const name = body.name?.toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
    }
    const icon =
      body.icon == null || body.icon.toString().trim() === ""
        ? null
        : body.icon.toString().trim();

    const category = await prisma.todo_categories.create({
      data: { profile_id: resolved.profileId, name, icon },
    });

    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error creating todo category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
