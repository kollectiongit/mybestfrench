import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../../generated/prisma";

const prisma = new PrismaClient();

// PUT /api/profiles/[id]/levels - Update profile levels
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { level_ids } = body;

    // Validate input
    if (!Array.isArray(level_ids)) {
      return NextResponse.json(
        { error: "level_ids must be an array" },
        { status: 400 }
      );
    }

    // Check if profile belongs to user
    const existingProfile = await prisma.profiles.findFirst({
      where: {
        id: id,
        user_id: session.user.id,
      },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Validate that all level_ids exist
    const validLevels = await prisma.levels.findMany({
      where: {
        id: {
          in: level_ids,
        },
      },
      select: {
        id: true,
      },
    });

    if (validLevels.length !== level_ids.length) {
      return NextResponse.json(
        { error: "One or more level IDs are invalid" },
        { status: 400 }
      );
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // Delete existing profile levels
      await tx.profile_levels.deleteMany({
        where: {
          profile_id: id,
        },
      });

      // Create new profile levels
      if (level_ids.length > 0) {
        await tx.profile_levels.createMany({
          data: level_ids.map((level_id: number) => ({
            profile_id: id,
            level_id: level_id,
          })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating profile levels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/profiles/[id]/levels - Get profile levels
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Check if profile belongs to user
    const existingProfile = await prisma.profiles.findFirst({
      where: {
        id: id,
        user_id: session.user.id,
      },
    });

    if (!existingProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get profile levels with level details
    const profileLevels = await prisma.profile_levels.findMany({
      where: {
        profile_id: id,
      },
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
      orderBy: {
        levels: {
          rank: "asc",
        },
      },
    });

    return NextResponse.json(profileLevels);
  } catch (error) {
    console.error("Error fetching profile levels:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}