import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import WritingPageClient from "./writing-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Expression écrite | My Best French",
  description: "Invente ton sujet avec le prof, écris ton texte et progresse à chaque essai.",
};

export default async function WritingPage() {
  const isAuthenticated = await isUserAuthenticated();
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Veuillez vous connecter pour accéder à l&apos;expression écrite.</p>
        </div>
      </div>
    );
  }
  return <WritingPageClient />;
}
