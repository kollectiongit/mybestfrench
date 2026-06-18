import { prisma } from "@/lib/prisma";
import {
  parseDateOnly,
  resolveProfileForRequest,
  toDateOnlyString,
  todayUtc,
} from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/todos/today?profile_id=...&date=YYYY-MM-DD
// Returns todos applicable on the given day (default: today) + the completion
// recorded that day (if any).
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveProfileForRequest(
      request,
      searchParams.get("profile_id")
    );
    if ("error" in resolved) return resolved.error;

    const day = parseDateOnly(searchParams.get("date")) || todayUtc();

    const todos = await prisma.todos.findMany({
      where: {
        profile_id: resolved.profileId,
        archived: false,
        AND: [
          { OR: [{ start_date: null }, { start_date: { lte: day } }] },
          { OR: [{ end_date: null }, { end_date: { gte: day } }] },
        ],
      },
      orderBy: [{ position: "asc" }, { created_at: "asc" }],
      include: {
        category: { select: { id: true, name: true, icon: true } },
        completions: { where: { completion_date: day } },
      },
    });

    const items = todos.map((t) => {
      const c = t.completions[0];
      return {
        id: t.id,
        name: t.name,
        unit: t.unit,
        target_value: t.target_value != null ? Number(t.target_value) : 0,
        icon: t.icon,
        position: t.position,
        category: t.category
          ? { id: t.category.id, name: t.category.name, icon: t.category.icon }
          : null,
        completion: c
          ? {
              id: c.id,
              completed_at: c.completed_at,
              actual_value: c.actual_value != null ? Number(c.actual_value) : null,
              satisfaction: c.satisfaction,
              duration_seconds: c.duration_seconds ?? null,
            }
          : null,
      };
    });

    return NextResponse.json(
      { date: toDateOnlyString(day), todos: items },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Error fetching today's todos:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
