import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/lecture/books?profile_id=...
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get("profile_id");
    if (!profileId) {
      return NextResponse.json(
        { error: "profile_id is required" },
        { status: 400 }
      );
    }

    const profile = await prisma.profiles.findFirst({
      where: { id: profileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const books = await prisma.books.findMany({
      where: { profile_id: profileId },
      orderBy: { created_at: "desc" },
      include: { _count: { select: { reading_logs: true } } },
    });

    const payload = books.map((b) => ({
      id: b.id,
      title: b.title,
      start_page: b.start_page,
      created_at: b.created_at,
      logs_count: b._count.reading_logs,
    }));

    return NextResponse.json({ books: payload });
  } catch (error) {
    console.error("Error listing books:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/lecture/books  { profile_id, title, start_page }
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const profileId: string | undefined = body.profile_id;
    const title: string | undefined = body.title?.toString().trim();
    const startPageRaw = body.start_page;

    if (!profileId || !title) {
      return NextResponse.json(
        { error: "profile_id and title are required" },
        { status: 400 }
      );
    }
    const startPage = Number.isFinite(Number(startPageRaw))
      ? Math.max(0, Math.trunc(Number(startPageRaw)))
      : 0;

    const profile = await prisma.profiles.findFirst({
      where: { id: profileId, user_id: session.user.id },
    });
    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const book = await prisma.books.create({
      data: {
        profile_id: profileId,
        title,
        start_page: startPage,
      },
    });

    // If profile has no active book, activate this one
    if (!profile.active_book_id) {
      await prisma.profiles.update({
        where: { id: profileId },
        data: { active_book_id: book.id },
      });
    }

    return NextResponse.json({ book });
  } catch (error) {
    console.error("Error creating book:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
