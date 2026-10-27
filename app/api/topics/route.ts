import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uniqueTopicSlug } from "@/lib/training/taxonomy";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/topics  { category_id, name }
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const name = body.name?.toString().trim();
    const categoryId = Number(body.category_id);
    if (!name || !Number.isInteger(categoryId)) {
      return NextResponse.json(
        { error: "La catégorie et le nom sont obligatoires" },
        { status: 400 }
      );
    }

    const existing = await prisma.topic.findFirst({
      where: { category_id: categoryId, name: { equals: name, mode: "insensitive" } },
    });
    if (existing) return NextResponse.json({ topic: existing });

    const topic = await prisma.topic.create({
      data: { category_id: categoryId, name, slug: await uniqueTopicSlug(name) },
    });
    return NextResponse.json({ topic });
  } catch (error) {
    console.error("Error creating topic:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
