import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest, toDateOnlyString } from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// YYYY-MM-DD from a Date's local parts.
function localKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// GET /api/todos/last-7-days?profile_id=...&week=current|previous
// For each day of the week: realized completions vs applicable todos.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveProfileForRequest(
      request,
      searchParams.get("profile_id")
    );
    if ("error" in resolved) return resolved.error;

    const week = searchParams.get("week") || "current";

    // Compute Monday→Sunday range (same logic as exercices-attempts/last-7-days).
    const now = new Date();
    const weekStart = new Date(now);
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setDate(now.getDate() - daysFromMonday);
    weekStart.setHours(0, 0, 0, 0);
    if (week === "previous") {
      weekStart.setDate(weekStart.getDate() - 7);
    }
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const [todos, completions] = await Promise.all([
      prisma.todos.findMany({
        where: { profile_id: resolved.profileId, archived: false },
        select: { start_date: true, end_date: true, created_at: true },
      }),
      prisma.todo_completions.findMany({
        where: {
          profile_id: resolved.profileId,
          completion_date: { gte: weekStart, lte: weekEnd },
        },
        select: { completion_date: true },
      }),
    ]);

    // Pre-compute string keys for todos.
    const todoKeys = todos.map((t) => ({
      start: t.start_date ? toDateOnlyString(t.start_date) : null,
      end: t.end_date ? toDateOnlyString(t.end_date) : null,
      created: toDateOnlyString(t.created_at),
    }));

    // Count realized completions per day.
    const realizedByDay = new Map<string, number>();
    completions.forEach((c) => {
      const key = toDateOnlyString(c.completion_date);
      realizedByDay.set(key, (realizedByDay.get(key) || 0) + 1);
    });

    const dayAbbrevs = ["DI", "LU", "MA", "ME", "JE", "VE", "SA"];
    const days: Array<{
      day: string;
      date: string;
      realized: number;
      applicable: number;
      percent: number;
    }> = [];

    let totalRealized = 0;
    let totalApplicable = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      date.setHours(0, 0, 0, 0);
      const key = localKey(date);

      const applicable = todoKeys.filter(
        (t) =>
          t.created <= key &&
          (t.start === null || t.start <= key) &&
          (t.end === null || t.end >= key)
      ).length;
      const realized = realizedByDay.get(key) || 0;
      const percent = applicable > 0 ? Math.round((realized / applicable) * 100) : 0;

      totalRealized += realized;
      totalApplicable += applicable;

      days.push({
        day: dayAbbrevs[date.getDay()],
        date: `${String(date.getDate()).padStart(2, "0")}/${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`,
        realized,
        applicable,
        percent,
      });
    }

    const totalPercent =
      totalApplicable > 0
        ? Math.round((totalRealized / totalApplicable) * 100)
        : 0;

    return NextResponse.json(
      { days, totalRealized, totalApplicable, totalPercent },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Error fetching last 7 days todos:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
