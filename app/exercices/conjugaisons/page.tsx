import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import ConjugaisonsPageClient from "./conjugaisons-page-client";

// Force dynamic rendering for this page since it needs authentication
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Conjugaison | My Best French",
  description: "Entraîne-toi à conjuguer les verbes et deviens un boss en Français",
};

export default async function ConjugaisonsPage() {
  const isAuthenticated = await isUserAuthenticated();

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">
            Veuillez vous connecter pour accéder aux exercices de conjugaison.
          </p>
        </div>
      </div>
    );
  }

  return <ConjugaisonsPageClient />;
}
