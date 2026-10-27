import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import SheetClient from "./sheet-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fiche d'exercices | My Best French",
};

export default async function SheetPage({ params }: { params: Promise<{ id: string }> }) {
  const isAuthenticated = await isUserAuthenticated();
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        Veuillez vous connecter pour accéder à vos exercices.
      </div>
    );
  }

  const { id } = await params;
  return <SheetClient sheetId={Number(id)} />;
}
