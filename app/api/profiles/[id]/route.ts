import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "../../../generated/prisma";

const prisma = new PrismaClient();

// PUT /api/profiles/[id] - Update a profile
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
    const { first_name, last_name, avatar_url, age, description } = body;

    // Validate required fields
    if (!first_name) {
      return NextResponse.json(
        { error: "First name is required" },
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

    const profile = await prisma.profiles.update({
      where: { id },
      data: {
        first_name,
        last_name,
        avatar_url,
        age: age ? parseInt(age) : null,
        description,
        updated_at: new Date(),
      },
      include: {
        profile_levels: {
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

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/profiles/[id] - Delete a profile
export async function DELETE(
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

    // Delete associated avatar file from Supabase if exists
    if (existingProfile.avatar_url) {
      try {
        const { createClient } = await import("@/utils/supabase/server");
        const { cookies } = await import("next/headers");
        const supabase = await createClient(await cookies());
        
        await supabase.storage.from("avatars").remove([existingProfile.avatar_url]);
      } catch (error) {
        console.error("Error deleting avatar file:", error);
        // Continue with profile deletion even if file deletion fails
      }
    }

    await prisma.profiles.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Error deleting profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
