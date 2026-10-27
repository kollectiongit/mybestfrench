import { prisma } from "@/lib/prisma";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { streamOutlineChat } from "@/lib/writing/ai";
import { ChatMessage } from "@/lib/writing/schema";
import {
  findOwnedProject,
  getStudentContext,
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_LENGTH,
  sanitizeMessages,
} from "@/lib/writing/server";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/writing/[id]/chat  { message? }
// Next message of the outline discussion, streamed as plain text. Without a
// message on an empty discussion, the coach opens it (with subject ideas).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const project = await findOwnedProject((await params).id, resolved.session.user.id, resolved.profileId);
    if (!project) return NextResponse.json({ error: "Expression écrite introuvable" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE_LENGTH) : "";
    const history = sanitizeMessages(project.chat_json);
    if (!message && history.length > 0) {
      return NextResponse.json({ error: "Message vide" }, { status: 400 });
    }
    if (history.length >= MAX_CHAT_MESSAGES) {
      return NextResponse.json(
        { error: "La discussion est très longue : valide ta trame ou commence un nouveau sujet" },
        { status: 400 }
      );
    }

    const messages: ChatMessage[] = message ? [...history, { role: "user", content: message }] : history;
    const student = await getStudentContext(resolved.profileId, project.id);
    const { stream, done } = streamOutlineChat({
      student,
      messages,
      currentOutline: project.outline_validated_at ? project.outline : null,
      minWords: project.min_words,
    });

    // Saved once the answer is complete (kept even if the student leaves the page)
    done.then(async (answer) => {
      if (!answer.trim()) return;
      await prisma.writing_project.update({
        where: { id: project.id },
        data: { chat_json: [...messages, { role: "assistant", content: answer }] as object[] },
      });
    }).catch((error) => console.error("Error saving outline chat:", error));

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Error in outline chat:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
