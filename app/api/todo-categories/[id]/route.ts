import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function loadOwnedCategory(id: number, profileId: string) {
  return prisma.todo_categories.findFirst({
    where: { id, profile_id: profileId },
    include: { _count: { select: { todos: true } } },
  });
}

// PATCH /api/todo-categories/[id]  { name?, icon? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const { id } = await params;
    const categoryId = Number(id);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await loadOwnedCategory(categoryId, resolved.profileId);
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: { name?: string; icon?: string | null } = {};
    if (typeof body.name === "string" && body.name.trim().length > 0) {
      data.name = body.name.trim();
    }
    if (body.icon !== undefined) {
      data.icon =
        body.icon == null || body.icon.toString().trim() === ""
          ? null
          : body.icon.toString().trim();
    }
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.todo_categories.update({
      where: { id: categoryId },
      data,
    });
    return NextResponse.json({ category: updated });
  } catch (error) {
    console.error("Error updating todo category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/todo-categories/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const { id } = await params;
    const categoryId = Number(id);
    if (!Number.isFinite(categoryId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const existing = await loadOwnedCategory(categoryId, resolved.profileId);
    if (!existing) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    // Detaching todos from the category happens automatically (onDelete: SetNull).
    await prisma.todo_categories.delete({ where: { id: categoryId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting todo category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
