import { auth } from "@/lib/auth";
import { isValidCurrency } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// PATCH /api/lecture/books/[id]  { title?, start_page? }
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
    const bookId = Number(id);
    if (!Number.isFinite(bookId)) {
      return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
    }

    const book = await prisma.books.findUnique({
      where: { id: bookId },
      include: { profiles: true },
    });
    if (!book || book.profiles.user_id !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const body = await request.json();
    const data: {
      title?: string;
      start_page?: number;
      remuneration_per_page?: number | null;
      currency?: string | null;
    } = {};
    if (typeof body.title === "string" && body.title.trim().length > 0) {
      data.title = body.title.trim();
    }
    if (body.start_page !== undefined) {
      const sp = Number(body.start_page);
      if (Number.isFinite(sp)) data.start_page = Math.max(0, Math.trunc(sp));
    }
    if (body.remuneration_per_page !== undefined) {
      if (body.remuneration_per_page === null || body.remuneration_per_page === "") {
        data.remuneration_per_page = null;
      } else {
        const r = Number(body.remuneration_per_page);
        if (!Number.isFinite(r) || r < 0) {
          return NextResponse.json(
            { error: "La rémunération doit être un nombre positif." },
            { status: 400 }
          );
        }
        data.remuneration_per_page = Math.round(r * 100) / 100;
      }
    }
    if (body.currency !== undefined) {
      if (body.currency === null || body.currency === "") {
        data.currency = null;
      } else if (isValidCurrency(body.currency)) {
        data.currency = body.currency;
      } else {
        return NextResponse.json({ error: "Devise invalide." }, { status: 400 });
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.books.update({
      where: { id: bookId },
      data,
    });

    return NextResponse.json({ book: updated });
  } catch (error) {
    console.error("Error updating book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/lecture/books/[id] — only allowed if no reading_logs exist for this book
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const bookId = Number(id);
    if (!Number.isFinite(bookId)) {
      return NextResponse.json({ error: "Invalid book id" }, { status: 400 });
    }

    const book = await prisma.books.findUnique({
      where: { id: bookId },
      include: {
        profiles: true,
        _count: { select: { reading_logs: true } },
      },
    });
    if (!book || book.profiles.user_id !== session.user.id) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    if (book._count.reading_logs > 0) {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer un livre qui a déjà des pages enregistrées.",
        },
        { status: 400 }
      );
    }

    await prisma.books.delete({ where: { id: bookId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
