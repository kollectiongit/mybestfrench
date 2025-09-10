import { auth } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { filename, bucket } = body;

    if (!filename || !bucket) {
      return NextResponse.json(
        { error: "Filename and bucket are required" },
        { status: 400 }
      );
    }

    // Delete from Supabase using server client
    const supabase = await createClient(await cookies());
    
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filename]);

    if (error) {
      console.error("Delete error:", error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression du fichier" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
