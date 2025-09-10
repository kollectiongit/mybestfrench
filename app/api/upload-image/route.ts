import { auth } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    console.log("Upload API: Starting upload process");
    console.log("Environment:", process.env.NODE_ENV);
    console.log("Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    console.log("Upload API: Session check result:", !!session);

    if (!session) {
      console.log("Upload API: No session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const bucket = formData.get("bucket") as string || "avatars";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Seuls les fichiers JPG, JPEG et PNG sont autorisés" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Le fichier ne doit pas dépasser 5MB" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split(".").pop();
    const uniqueFileName = `profile_${timestamp}_${randomString}.${extension}`;

    // Upload to Supabase using server client
    console.log("Upload API: Creating Supabase client");
    const supabase = await createClient(await cookies());
    
    console.log("Upload API: Starting upload to Supabase", { bucket, uniqueFileName });
    const { error } = await supabase.storage
      .from(bucket)
      .upload(uniqueFileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return NextResponse.json(
        { error: "Erreur lors de l'upload du fichier" },
        { status: 500 }
      );
    }

    console.log("Upload API: Upload successful");

    // Get public URL
    const { data: publicData } = supabase.storage
      .from(bucket)
      .getPublicUrl(uniqueFileName);

    return NextResponse.json({
      success: true,
      filename: uniqueFileName,
      publicUrl: publicData.publicUrl,
    });
  } catch (error) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
