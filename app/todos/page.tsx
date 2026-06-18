import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import TodosPageClient from "./todos-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "To-Do | My Best French",
  description: "Suis tes tâches quotidiennes et atteins tes objectifs.",
};

export default async function TodosPage() {
  const isAuthenticated = await isUserAuthenticated();

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">
            Veuillez vous connecter pour accéder à vos To-Do.
          </p>
        </div>
      </div>
    );
  }

  return <TodosPageClient />;
}
