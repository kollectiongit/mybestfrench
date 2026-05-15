import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/profiles/[id]/active-books
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const profile = await prisma.profiles.findFirst({
      where: { id, user_id: session.user.id },
      select: { active_book_id: true, active_book_id_2: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }
    return NextResponse.json({
      slot_1: profile.active_book_id,
      slot_2: profile.active_book_id_2,
    });
  } catch (error) {
    console.error("Error fetching active books:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function toNullableInt(v: unknown): number | null | undefined {
  if (v === null) return null;
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

// PATCH /api/profiles/[id]/active-books  { slot_1?: number|null, slot_2?: number|null }
// Only the fields present in the body are updated. Use `null` to clear a slot.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const slot1 = toNullableInt(body.slot_1);
    const slot2 = toNullableInt(body.slot_2);

    if (slot1 === undefined && slot2 === undefined) {
      return NextResponse.json(
        { error: "Provide at least slot_1 or slot_2" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findFirst({
      where: { id, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Compute the final state for each slot (using current values when not provided)
    const next1 = slot1 === undefined ? profile.active_book_id : slot1;
    const next2 = slot2 === undefined ? profile.active_book_id_2 : slot2;

    if (next1 !== null && next2 !== null && next1 === next2) {
      return NextResponse.json(
        { error: "Les deux livres actifs doivent être différents." },
        { status: 400 }
      );
    }

    const idsToCheck = [next1, next2].filter(
      (v): v is number => typeof v === "number"
    );
    if (idsToCheck.length > 0) {
      const books = await prisma.books.findMany({
        where: { id: { in: idsToCheck }, profile_id: id },
        select: { id: true },
      });
      if (books.length !== idsToCheck.length) {
        return NextResponse.json(
          { error: "Un des livres ne correspond pas à ce profil" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.profiles.update({
      where: { id },
      data: {
        active_book_id: next1,
        active_book_id_2: next2,
      },
    });

    return NextResponse.json({
      profile: {
        id: updated.id,
        active_book_id: updated.active_book_id,
        active_book_id_2: updated.active_book_id_2,
      },
    });
  } catch (error) {
    console.error("Error setting active books:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
