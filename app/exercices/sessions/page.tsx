import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import SessionsPageClient from "./sessions-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Exercices | My Best French",
  description: "Sessions d'entraînement en grammaire, orthographe et conjugaison.",
};

export default async function SessionsPage() {
  const isAuthenticated = await isUserAuthenticated();

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Veuillez vous connecter pour accéder à vos exercices.</p>
        </div>
      </div>
    );
  }

  return <SessionsPageClient />;
}
