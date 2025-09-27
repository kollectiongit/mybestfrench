import { getCurrentProfile, isUserAuthenticated } from "@/lib/current-profile";
import {
  getDictationsForProfile,
  type DictationData,
} from "@/lib/dictations-server";
import type { Metadata } from "next";
import DicteesPageClient from "./dictees-page-client";

// Force dynamic rendering for this page since it needs authentication
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Liste des dictées | My Best French",
  description: "Choisis ta dictée et deviens un boss en Français",
};

export default async function DicteesPage() {
  // Vérifier l'authentification côté serveur
  const isAuthenticated = await isUserAuthenticated();

  if (!isAuthenticated) {
    // Redirection côté serveur si non authentifié
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">
            Veuillez vous connecter pour accéder aux dictées.
          </p>
        </div>
      </div>
    );
  }

  // Récupérer le profil actuel côté serveur
  const currentProfile = await getCurrentProfile();

  if (!currentProfile) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">
            Aucun profil trouvé. Veuillez créer un profil.
          </p>
        </div>
      </div>
    );
  }

  // Récupérer les dictées côté serveur
  let dictations: DictationData[] = [];

  try {
    // Récupérer les IDs des niveaux du profil
    const profileLevelIds =
      currentProfile.profile_levels?.map((pl) => pl.level_id) || [];

    // Utiliser la fonction helper pour récupérer les dictées
    dictations = await getDictationsForProfile(
      currentProfile.id,
      profileLevelIds
    );
  } catch (error) {
    console.error("Error fetching dictations:", error);
  }

  // Passer les données pré-chargées au composant client
  return (
    <DicteesPageClient
      initialDictations={dictations}
      initialProfile={currentProfile}
    />
  );
}
