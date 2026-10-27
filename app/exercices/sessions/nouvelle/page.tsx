import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import NewSheetClient from "./new-sheet-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nouvelle fiche d'exercices | My Best French",
};

export default async function NewSheetPage() {
  const isAuthenticated = await isUserAuthenticated();
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        Veuillez vous connecter pour créer une fiche.
      </div>
    );
  }
  return <NewSheetClient />;
}
