import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/dictations/[id] - Fetch single dictation by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Dictation ID is required" },
        { status: 400 }
      );
    }

    const dictation = await prisma.dictation.findUnique({
      where: {
        id: id,
      },
      include: {
        topic: {
          select: {
            id: true,
            name: true,
            slug: true,
            rules_explanation_message: true,
            category: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        dictations_levels: {
          include: {
            levels: {
              select: {
                id: true,
                code: true,
                label: true,
                rank: true,
              },
            },
          },
        },
      },
    });

    if (!dictation) {
      return NextResponse.json(
        { error: "Dictation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(dictation);
  } catch (error) {
    console.error("Error fetching dictation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
