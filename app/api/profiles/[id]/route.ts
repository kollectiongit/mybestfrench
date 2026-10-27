import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering due to request.headers usage
export const dynamic = 'force-dynamic';

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
    const {
      first_name,
      last_name,
      avatar_url,
      age,
      description,
      weekly_pages_goal,
      conjugaison_show_radical,
      conjugaison_groupes,
      tts_voice_id,
      tts_voice_mode,
      tts_voice_ids,
      writing_min_words,
      favorite_movies,
      news_interests,
    } = body;

    console.log("Profile update API: Received data:", {
      id,
      first_name,
      last_name,
      avatar_url,
      age,
      description
    });

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

    let goalValue: number | null | undefined = undefined;
    if (weekly_pages_goal === null || weekly_pages_goal === "") {
      goalValue = null;
    } else if (weekly_pages_goal !== undefined) {
      const n = Number(weekly_pages_goal);
      if (Number.isFinite(n) && n >= 0) {
        goalValue = Math.trunc(n);
      } else {
        return NextResponse.json(
          { error: "weekly_pages_goal must be a positive integer" },
          { status: 400 }
        );
      }
    }

    const groupesValue = Array.isArray(conjugaison_groupes)
      ? conjugaison_groupes.filter((g: unknown) => [1, 2, 3].includes(g as number))
      : undefined;

    const profile = await prisma.profiles.update({
      where: { id },
      data: {
        first_name,
        last_name,
        avatar_url,
        age: age ? parseInt(age) : null,
        description,
        ...(goalValue !== undefined ? { weekly_pages_goal: goalValue } : {}),
        ...(conjugaison_show_radical !== undefined
          ? { conjugaison_show_radical: !!conjugaison_show_radical }
          : {}),
        ...(groupesValue !== undefined
          ? { conjugaison_groupes: groupesValue }
          : {}),
        ...(tts_voice_id !== undefined
          ? {
              tts_voice_id:
                typeof tts_voice_id === "string" && /^[A-Za-z0-9]{1,64}$/.test(tts_voice_id)
                  ? tts_voice_id
                  : null,
            }
          : {}),
        ...(["fixed", "rotate", "device"].includes(tts_voice_mode)
          ? { tts_voice_mode }
          : {}),
        ...(Array.isArray(tts_voice_ids)
          ? {
              tts_voice_ids: tts_voice_ids
                .filter((v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9]{1,64}$/.test(v))
                .slice(0, 50),
            }
          : {}),
        ...(writing_min_words !== undefined && writing_min_words !== "" &&
        Number.isFinite(Number(writing_min_words))
          ? { writing_min_words: Math.min(2000, Math.max(20, Math.round(Number(writing_min_words)))) }
          : {}),
        ...(typeof favorite_movies === "string"
          ? { favorite_movies: favorite_movies.trim().slice(0, 1000) || null }
          : {}),
        ...(typeof news_interests === "string"
          ? { news_interests: news_interests.trim().slice(0, 1000) || null }
          : {}),
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
        const { createClient } = await import("@/utils/spabase/server");
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
