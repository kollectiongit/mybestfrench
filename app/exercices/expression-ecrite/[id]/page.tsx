import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import ProjectClient from "./project-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Expression écrite | My Best French",
};

export default async function WritingProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const isAuthenticated = await isUserAuthenticated();
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        Veuillez vous connecter pour accéder à l&apos;expression écrite.
      </div>
    );
  }
  const { id } = await params;
  return <ProjectClient key={id} projectId={id} />;
}
