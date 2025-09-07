import { NextResponse } from "next/server";
import { PrismaClient } from "../../generated/prisma";

const prisma = new PrismaClient();

// GET /api/levels - Fetch all levels sorted by rank
export async function GET() {
  try {
    const levels = await prisma.levels.findMany({
      orderBy: {
        rank: "asc",
      },
      select: {
        id: true,
        code: true,
        label: true,
        rank: true,
      },
    });

    return NextResponse.json(levels);
  } catch (error) {
    console.error("Error fetching levels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
