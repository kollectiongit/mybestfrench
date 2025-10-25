import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// DELETE /api/attempts/[id] - Delete an attempt
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
    const attemptId = parseInt(id);

    if (isNaN(attemptId)) {
      return NextResponse.json({ error: "Invalid attempt ID" }, { status: 400 });
    }

    // Check if attempt belongs to user
    const existingAttempt = await prisma.exercices_attempts.findFirst({
      where: {
        id: attemptId,
        user_id: session.user.id,
      },
    });

    if (!existingAttempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    // Delete the attempt
    await prisma.exercices_attempts.delete({
      where: { id: attemptId },
    });

    // Invalidate cache for this dictation and profile
    try {
      revalidateTag('dictations');
      revalidateTag(`dictation-${existingAttempt.dictation_id}`);
      revalidateTag(`profile-${existingAttempt.profile_id}`);
      console.log("Cache invalidated after attempt deletion");
    } catch (cacheError) {
      console.error("Error invalidating cache:", cacheError);
    }

    return NextResponse.json({ message: "Attempt deleted successfully" });
  } catch (error) {
    console.error("Error deleting attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
