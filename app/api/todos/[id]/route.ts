import { prisma } from "@/lib/prisma";
import {
  parseDateOnly,
  parseDecimal,
  resolveProfileForRequest,
} from "@/lib/todo-api";
import { NextRequest, NextResponse } from "next/server";
import { serializeTodo } from "../route";

export const dynamic = "force-dynamic";

// PATCH /api/todos/[id] — edit fields and/or archive
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

    const existing = await prisma.todos.findFirst({
      where: { id: todoId, profile_id: resolved.profileId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: {
      name?: string;
      unit?: string;
      target_value?: number;
      category_id?: number | null;
      icon?: string | null;
      start_date?: Date | null;
      end_date?: Date | null;
      archived?: boolean;
    } = {};

    if (typeof body.name === "string" && body.name.trim().length > 0) {
      data.name = body.name.trim();
    }
    if (typeof body.unit === "string" && body.unit.trim().length > 0) {
      data.unit = body.unit.trim();
    }
    if (body.target_value !== undefined) {
      const t = parseDecimal(body.target_value);
      if (t === null) {
        return NextResponse.json(
          { error: "L'objectif doit être un nombre positif" },
          { status: 400 }
        );
      }
      data.target_value = t;
    }
    if (body.category_id !== undefined) {
      if (body.category_id == null || body.category_id === "") {
        data.category_id = null;
      } else {
        const cid = Number(body.category_id);
        if (!Number.isFinite(cid)) {
          return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
        }
        const cat = await prisma.todo_categories.findFirst({
          where: { id: cid, profile_id: resolved.profileId },
        });
        if (!cat) {
          return NextResponse.json({ error: "Catégorie invalide" }, { status: 400 });
        }
        data.category_id = cid;
      }
    }
    if (body.icon !== undefined) {
      data.icon =
        body.icon == null || body.icon.toString().trim() === ""
          ? null
          : body.icon.toString().trim();
    }
    if (body.start_date !== undefined) {
      data.start_date =
        body.start_date == null || body.start_date === ""
          ? null
          : parseDateOnly(body.start_date);
    }
    if (body.end_date !== undefined) {
      data.end_date =
        body.end_date == null || body.end_date === ""
          ? null
          : parseDateOnly(body.end_date);
    }
    if (typeof body.archived === "boolean") {
      data.archived = body.archived;
    }

    const nextStart =
      data.start_date !== undefined ? data.start_date : existing.start_date;
    const nextEnd = data.end_date !== undefined ? data.end_date : existing.end_date;
    if (nextStart && nextEnd && nextStart > nextEnd) {
      return NextResponse.json(
        { error: "La date de début doit précéder la date de fin" },
        { status: 400 }
      );
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await prisma.todos.update({
      where: { id: todoId },
      data,
      include: {
        category: { select: { id: true, name: true, icon: true } },
        _count: { select: { completions: true } },
      },
    });

    return NextResponse.json({ todo: serializeTodo(updated) });
  } catch (error) {
    console.error("Error updating todo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/todos/[id] — only when no completions exist
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

    const existing = await prisma.todos.findFirst({
      where: { id: todoId, profile_id: resolved.profileId },
      include: { _count: { select: { completions: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Todo not found" }, { status: 404 });
    }

    if (existing._count.completions > 0) {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer une To-Do qui a déjà des réalisations. Archive-la à la place.",
        },
        { status: 409 }
      );
    }

    await prisma.todos.delete({ where: { id: todoId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting todo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
