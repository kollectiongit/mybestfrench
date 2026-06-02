import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import ConjugaisonsHistoryClient from "./conjugaisons-history-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Historique de conjugaison | My Best French",
  description: "Retrouve toutes les conjugaisons que tu as réalisées",
};

export default async function ConjugaisonsHistoryPage() {
  const isAuthenticated = await isUserAuthenticated();

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">
            Veuillez vous connecter pour accéder à votre historique de conjugaison.
          </p>
        </div>
      </div>
    );
  }

  return <ConjugaisonsHistoryClient />;
}
