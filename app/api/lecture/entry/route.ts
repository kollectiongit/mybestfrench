import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function parseDateOnly(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  if (isNaN(d.getTime())) return null;
  return d;
}

function formatDateFr(d: Date): string {
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

function buildToastMessage(pagesRead: number): {
  message: string;
  level: "info" | "success";
} {
  if (pagesRead <= 0) return { message: "Pas top", level: "info" };
  if (pagesRead <= 5) return { message: "Bof", level: "info" };
  if (pagesRead <= 10) return { message: "C'est bien", level: "success" };
  if (pagesRead <= 20) return { message: "C'est très bien", level: "success" };
  return { message: "C'est extra", level: "success" };
}

// POST /api/lecture/entry  { profile_id, book_id, read_date, page_number }
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const profileId: string | undefined = body.profile_id;
    const readDateStr: string | undefined = body.read_date;
    const pageNumber = Number(body.page_number);
    const bookIdRaw = Number(body.book_id);

    if (!profileId || !readDateStr) {
      return NextResponse.json(
        { error: "profile_id and read_date are required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(bookIdRaw)) {
      return NextResponse.json(
        { error: "book_id is required" },
        { status: 400 }
      );
    }
    if (!Number.isFinite(pageNumber) || pageNumber < 0) {
      return NextResponse.json(
        { error: "page_number must be a positive integer" },
        { status: 400 }
      );
    }
    const bookId = Math.trunc(bookIdRaw);
    const pageInt = Math.trunc(pageNumber);
    const readDate = parseDateOnly(readDateStr);
    if (!readDate) {
      return NextResponse.json({ error: "Invalid read_date" }, { status: 400 });
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: profileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const book = await prisma.books.findFirst({
      where: { id: bookId, profile_id: profileId },
    });
    if (!book) {
      return NextResponse.json(
        { error: "Ce livre n'appartient pas à ce profil." },
        { status: 400 }
      );
    }

    const existing = await prisma.reading_logs.findUnique({
      where: {
        profile_id_book_id_read_date: {
          profile_id: profileId,
          book_id: bookId,
          read_date: readDate,
        },
      },
    });

    // Page must be >= last same-book entry's page (or book.start_page if first)
    const prevSameBook = await prisma.reading_logs.findFirst({
      where: {
        profile_id: profileId,
        book_id: bookId,
        read_date: { lt: readDate },
      },
      orderBy: { read_date: "desc" },
    });
    const minAllowed = prevSameBook ? prevSameBook.page_number : book.start_page;
    if (pageInt < minAllowed) {
      return NextResponse.json(
        {
          error: `Le numéro de page doit être au moins ${minAllowed} (page précédente du même livre).`,
        },
        { status: 400 }
      );
    }

    const nextSameBook = await prisma.reading_logs.findFirst({
      where: {
        profile_id: profileId,
        book_id: bookId,
        read_date: { gt: readDate },
      },
      orderBy: { read_date: "asc" },
    });
    if (nextSameBook && pageInt > nextSameBook.page_number) {
      return NextResponse.json(
        {
          error: `Cette modification casserait la cohérence avec le ${formatDateFr(nextSameBook.read_date)} (page ${nextSameBook.page_number}).`,
        },
        { status: 400 }
      );
    }

    const pagesReadCount = pageInt - minAllowed;

    const result = await prisma.$transaction(async (tx) => {
      let saved;
      if (existing) {
        saved = await tx.reading_logs.update({
          where: { id: existing.id },
          data: {
            page_number: pageInt,
            pages_read_count: pagesReadCount,
          },
        });
      } else {
        saved = await tx.reading_logs.create({
          data: {
            user_id: session.user.id,
            profile_id: profileId,
            book_id: bookId,
            read_date: readDate,
            page_number: pageInt,
            pages_read_count: pagesReadCount,
          },
        });
      }

      if (nextSameBook) {
        await tx.reading_logs.update({
          where: { id: nextSameBook.id },
          data: {
            pages_read_count: nextSameBook.page_number - pageInt,
          },
        });
      }

      return saved;
    });

    const toast = buildToastMessage(pagesReadCount);

    return NextResponse.json({
      entry: {
        id: result.id,
        profile_id: result.profile_id,
        book_id: result.book_id,
        read_date: result.read_date.toISOString().slice(0, 10),
        page_number: result.page_number,
        pages_read_count: result.pages_read_count,
      },
      toast,
    });
  } catch (error) {
    console.error("Error saving reading entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/lecture/entry?profile_id=...&book_id=...&read_date=YYYY-MM-DD
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");
    const bookIdRaw = searchParams.get("book_id");
    const readDateStr = searchParams.get("read_date");
    if (!profileId || !bookIdRaw || !readDateStr) {
      return NextResponse.json(
        { error: "profile_id, book_id and read_date are required" },
        { status: 400 }
      );
    }
    const bookId = Number(bookIdRaw);
    if (!Number.isFinite(bookId)) {
      return NextResponse.json({ error: "Invalid book_id" }, { status: 400 });
    }
    const readDate = parseDateOnly(readDateStr);
    if (!readDate) {
      return NextResponse.json({ error: "Invalid read_date" }, { status: 400 });
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: profileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const existing = await prisma.reading_logs.findUnique({
      where: {
        profile_id_book_id_read_date: {
          profile_id: profileId,
          book_id: Math.trunc(bookId),
          read_date: readDate,
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ success: true });
    }

    const nextSameBook = await prisma.reading_logs.findFirst({
      where: {
        profile_id: profileId,
        book_id: existing.book_id,
        read_date: { gt: readDate },
      },
    });
    if (nextSameBook) {
      return NextResponse.json(
        {
          error:
            "Impossible de supprimer : des entrées du même livre existent après cette date.",
        },
        { status: 400 }
      );
    }

    await prisma.reading_logs.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting reading entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
