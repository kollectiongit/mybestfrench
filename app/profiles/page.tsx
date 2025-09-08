import type { Metadata } from "next";
import { Suspense } from "react";
import ProfilesPageClient from "./profiles-page-client";

export const metadata: Metadata = {
  title: "Mes profils My Best French",
  description: "Crée et gère tes différents profils",
};

export default function ProfilesPage() {
  return (
    <Suspense
      fallback={<div className="container mx-auto px-4 py-8">Chargement…</div>}
    >
      <ProfilesPageClient />
    </Suspense>
  );
}
