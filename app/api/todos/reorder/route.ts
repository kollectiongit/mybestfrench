import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/todos/reorder  { ids: number[] }
// Sets each todo's position to its index in the provided array.
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const resolved = await resolveProfileForRequest(request, body.profile_id);
    if ("error" in resolved) return resolved.error;

    const ids: unknown = body.ids;
    if (!Array.isArray(ids) || ids.some((id) => !Number.isFinite(Number(id)))) {
      return NextResponse.json({ error: "ids invalides" }, { status: 400 });
    }
    const numericIds = ids.map((id) => Number(id));

    // Only reorder todos that actually belong to this profile.
    const owned = await prisma.todos.findMany({
      where: { id: { in: numericIds }, profile_id: resolved.profileId },
      select: { id: true },
    });
    const ownedSet = new Set(owned.map((t) => t.id));

    await prisma.$transaction(
      numericIds
        .filter((id) => ownedSet.has(id))
        .map((id, index) =>
          prisma.todos.update({ where: { id }, data: { position: index } })
        )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering todos:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
