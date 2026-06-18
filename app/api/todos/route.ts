import { prisma } from "@/lib/prisma";
import {
  parseDateOnly,
  parseDecimal,
  resolveProfileForRequest,
  toDateOnlyString,
} from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type TodoWithExtras = {
  id: number;
  category_id: number | null;
  name: string;
  unit: string;
  target_value: unknown;
  icon: string | null;
  position: number;
  start_date: Date | null;
  end_date: Date | null;
  archived: boolean;
  created_at: Date;
  category?: { id: number; name: string; icon: string | null } | null;
  _count?: { completions: number };
};

export function serializeTodo(t: TodoWithExtras) {
  return {
    id: t.id,
    category_id: t.category_id,
    category: t.category
      ? { id: t.category.id, name: t.category.name, icon: t.category.icon }
      : null,
    name: t.name,
    unit: t.unit,
    target_value: t.target_value != null ? Number(t.target_value) : 0,
    icon: t.icon,
    position: t.position,
    start_date: t.start_date ? toDateOnlyString(t.start_date) : null,
    end_date: t.end_date ? toDateOnlyString(t.end_date) : null,
    archived: t.archived,
    created_at: t.created_at,
    completions_count: t._count?.completions ?? 0,
  };
}

// GET /api/todos?profile_id=...&include_archived=1
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolved = await resolveProfileForRequest(
      request,
      searchParams.get("profile_id")
    );
    if ("error" in resolved) return resolved.error;

    const includeArchived = searchParams.get("include_archived") === "1";

    const todos = await prisma.todos.findMany({
      where: {
        profile_id: resolved.profileId,
        ...(includeArchived ? {} : { archived: false }),
      },
      orderBy: [{ position: "asc" }, { created_at: "asc" }],
      include: {
        category: { select: { id: true, name: true, icon: true } },
        _count: { select: { completions: true } },
      },
    });

    return NextResponse.json({ todos: todos.map(serializeTodo) });
  } catch (error) {
    console.error("Error listing todos:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/todos  { profile_id, name, unit, target_value, category_id?, icon?, start_date?, end_date? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const resolved = await resolveProfileForRequest(request, body.profile_id);
    if ("error" in resolved) return resolved.error;

    const name = body.name?.toString().trim();
    const unit = body.unit?.toString().trim();
    if (!name || !unit) {
      return NextResponse.json(
        { error: "Le nom et l'unité sont obligatoires" },
        { status: 400 }
      );
    }
    const target = parseDecimal(body.target_value);
    if (target === null) {
      return NextResponse.json(
        { error: "L'objectif doit être un nombre positif" },
        { status: 400 }
      );
    }

    // Optional category — must belong to this profile.
    let categoryId: number | null = null;
    if (body.category_id != null && body.category_id !== "") {
      const cid = Number(body.category_id);
      if (Number.isFinite(cid)) {
        const cat = await prisma.todo_categories.findFirst({
          where: { id: cid, profile_id: resolved.profileId },
        });
        if (!cat) {
          return NextResponse.json(
            { error: "Catégorie invalide" },
            { status: 400 }
          );
        }
        categoryId = cid;
      }
    }

    const icon =
      body.icon == null || body.icon.toString().trim() === ""
        ? null
        : body.icon.toString().trim();
    const startDate = parseDateOnly(body.start_date);
    const endDate = parseDateOnly(body.end_date);
    if (startDate && endDate && startDate > endDate) {
      return NextResponse.json(
        { error: "La date de début doit précéder la date de fin" },
        { status: 400 }
      );
    }

    // New todos go to the end of the list.
    const last = await prisma.todos.aggregate({
      where: { profile_id: resolved.profileId },
      _max: { position: true },
    });
    const nextPosition = (last._max.position ?? -1) + 1;

    const todo = await prisma.todos.create({
      data: {
        profile_id: resolved.profileId,
        name,
        unit,
        target_value: target,
        category_id: categoryId,
        icon,
        position: nextPosition,
        start_date: startDate,
        end_date: endDate,
      },
      include: {
        category: { select: { id: true, name: true, icon: true } },
        _count: { select: { completions: true } },
      },
    });

    return NextResponse.json({ todo: serializeTodo(todo) });
  } catch (error) {
    console.error("Error creating todo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
