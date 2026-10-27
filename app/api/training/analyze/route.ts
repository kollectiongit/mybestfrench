import { analyzeSource } from "@/lib/training/ai";
import { getProfileContext, getTaxonomy } from "@/lib/training/server";
import { resolveProfileForRequest } from "@/lib/todo-api";
import { createClient } from "@/utils/spabase/server";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_IMAGES = 4;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// POST /api/training/analyze (multipart: images[], text?)
// Stores the photos, then asks the AI for lesson, skills and classification.
export async function POST(request: NextRequest) {
  try {
    const resolved = await resolveProfileForRequest(request);
    if ("error" in resolved) return resolved.error;

    const form = await request.formData();
    const text = form.get("text")?.toString() ?? null;
    const files = form.getAll("images").filter((f): f is File => f instanceof File);

    if (files.length === 0 && !text?.trim()) {
      return NextResponse.json(
        { error: "Ajoute une photo ou décris le thème de la fiche" },
        { status: 400 }
      );
    }
    if (files.length > MAX_IMAGES) {
      return NextResponse.json({ error: `${MAX_IMAGES} photos maximum` }, { status: 400 });
    }
    if (files.some((f) => !ALLOWED_TYPES.includes(f.type))) {
      return NextResponse.json({ error: "Formats acceptés : JPG, PNG, WEBP" }, { status: 400 });
    }

    const supabase = await createClient(await cookies());
    const images: { mime: string; base64: string }[] = [];
    const paths: string[] = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const filename = `training_${Date.now()}_${randomUUID()}.${extension}`;
      const { error } = await supabase.storage
        .from("images")
        .upload(filename, buffer, { contentType: file.type, upsert: false });
      if (error) {
        console.error("Error uploading training image:", error);
        return NextResponse.json({ error: "Erreur lors de l'envoi de la photo" }, { status: 500 });
      }
      paths.push(filename);
      images.push({ mime: file.type, base64: buffer.toString("base64") });
    }

    const [taxonomy, student] = await Promise.all([
      getTaxonomy(),
      getProfileContext(resolved.profileId),
    ]);
    const analysis = await analyzeSource({
      images,
      text,
      taxonomy,
      levelLabel: student.levelLabel,
    });

    // Only keep ids that really exist
    const category = taxonomy.find((c) => c.id === analysis.category.existing_id);
    const topic = category?.topics.find((t) => t.id === analysis.topic.existing_id);

    return NextResponse.json({
      analysis: {
        ...analysis,
        category: {
          existing_id: category?.id ?? null,
          new_name: category ? null : analysis.category.new_name,
        },
        topic: {
          existing_id: topic?.id ?? null,
          new_name: topic ? null : analysis.topic.new_name ?? analysis.title,
        },
      },
      source_images: paths,
    });
  } catch (error) {
    console.error("Error analyzing training source:", error);
    return NextResponse.json(
      { error: "L'analyse a échoué, réessaie dans un instant" },
      { status: 500 }
    );
  }
}
