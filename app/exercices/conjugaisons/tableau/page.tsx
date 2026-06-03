import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import ConjugaisonsTableClient from "./conjugaisons-table-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Tableau de résultats | My Best French",
  description: "Vue d'ensemble de tes conjugaisons par verbe, temps et personne",
};

export default async function ConjugaisonsTablePage() {
  const isAuthenticated = await isUserAuthenticated();

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">
            Veuillez vous connecter pour accéder au tableau de résultats.
          </p>
        </div>
      </div>
    );
  }

  return <ConjugaisonsTableClient />;
}
