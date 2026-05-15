import type { Metadata } from "next";
import { Suspense } from "react";
import LecturePageClient from "./lecture-page-client";

export const metadata: Metadata = {
  title: "Lecture | My Best French",
  description: "Suis le nombre de pages lues chaque jour par chaque enfant.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function LecturePage() {
  return (
    <Suspense
      fallback={<div className="container mx-auto px-4 py-8">Chargement…</div>}
    >
      <LecturePageClient />
    </Suspense>
  );
}
