import { prisma } from "@/lib/prisma";
import {
  parseDateOnly,
  parseDecimal,
  resolveProfileForRequest,
  todayUtc,
} from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function serializeCompletion(c: {
  id: number;
  completed_at: Date;
  actual_value: unknown;
  satisfaction: number | null;
  duration_seconds: number | null;
}) {
  return {
    id: c.id,
    completed_at: c.completed_at,
    actual_value: c.actual_value != null ? Number(c.actual_value) : null,
    satisfaction: c.satisfaction,
    duration_seconds: c.duration_seconds ?? null,
  };
}

function parseDurationSeconds(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

async function loadOwnedTodo(todoId: number, profileId: string) {
  return prisma.todos.findFirst({
    where: { id: todoId, profile_id: profileId },
  });
}

function parseSatisfaction(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  if (![1, 2, 3].includes(n)) return undefined;
  return n;
}

// POST /api/todos/[id]/completion — check the todo for a given day (default today)
// Body: { date?, actual_value?, satisfaction? }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const { id } = await params;
    const todoId = Number(id);
    if (!Number.isFinite(todoId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const todo = await loadOwnedTodo(todoId, resolved.profileId);
    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const day = parseDateOnly(body.date) || todayUtc();
    const actualValue = parseDecimal(body.actual_value);
    const satisfaction = parseSatisfaction(body.satisfaction);
    const duration = parseDurationSeconds(body.duration_seconds);

    const completion = await prisma.todo_completions.upsert({
      where: { todo_id_completion_date: { todo_id: todoId, completion_date: day } },
      create: {
        todo_id: todoId,
        profile_id: resolved.profileId,
        user_id: resolved.session.user.id,
        completion_date: day,
        actual_value: actualValue,
        satisfaction: satisfaction === undefined ? null : satisfaction,
        duration_seconds: duration === undefined ? null : duration,
      },
      update: {},
    });

    return NextResponse.json({ completion: serializeCompletion(completion) });
  } catch (error) {
    console.error("Error completing todo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/todos/[id]/completion — update actual_value / satisfaction for a day
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const { id } = await params;
    const todoId = Number(id);
    if (!Number.isFinite(todoId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const todo = await loadOwnedTodo(todoId, resolved.profileId);
    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const body = await request.json();
    const day = parseDateOnly(body.date) || todayUtc();

    const existing = await prisma.todo_completions.findUnique({
      where: { todo_id_completion_date: { todo_id: todoId, completion_date: day } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Completion not found" }, { status: 404 });
    }

    const data: {
      actual_value?: number | null;
      satisfaction?: number | null;
      duration_seconds?: number | null;
    } = {};
    if (body.actual_value !== undefined) {
      data.actual_value = parseDecimal(body.actual_value);
    }
    if (body.satisfaction !== undefined) {
      const s = parseSatisfaction(body.satisfaction);
      if (s === undefined) {
        return NextResponse.json({ error: "Satisfaction invalide" }, { status: 400 });
      }
      data.satisfaction = s;
    }
    if (body.duration_seconds !== undefined) {
      const d = parseDurationSeconds(body.duration_seconds);
      if (d === undefined) {
        return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
      }
      data.duration_seconds = d;
    }

    const updated = await prisma.todo_completions.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ completion: serializeCompletion(updated) });
  } catch (error) {
    console.error("Error updating todo completion:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/todos/[id]/completion?date=YYYY-MM-DD — uncheck the todo for a day
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const { id } = await params;
    const todoId = Number(id);
    if (!Number.isFinite(todoId)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const todo = await loadOwnedTodo(todoId, resolved.profileId);
    if (!todo) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const day = parseDateOnly(searchParams.get("date")) || todayUtc();

    await prisma.todo_completions.deleteMany({
      where: { todo_id: todoId, completion_date: day },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting todo completion:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
