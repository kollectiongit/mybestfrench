import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueCategorySlug } from "@/lib/training/taxonomy";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/categories - Categories with their topics (shared by dictations and training sheets)
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        topic: {
          orderBy: { name: "asc" },
          include: {
            _count: {
              select: {
                dictation: true,
                exercises: true,
                training_sheets: { where: { user_id: session.user.id } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        topics: c.topic.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          dictations_count: t._count.dictation,
          sheets_count: t._count.training_sheets,
          in_use: t._count.dictation + t._count.exercises > 0,
        })),
      })),
    });
  } catch (error) {
    console.error("Error listing categories:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/categories  { name }
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = body.name?.toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Le nom est obligatoire" }, { status: 400 });
    }

    const existing = await prisma.category.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return NextResponse.json({ category: existing });

    const category = await prisma.category.create({
      data: { name, slug: await uniqueCategorySlug(name) },
    });
    return NextResponse.json({ category });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
