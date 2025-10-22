import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ message: "Attempt deleted successfully" });
  } catch (error) {
    console.error("Error deleting attempt:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
