import type { Metadata } from "next";
import DicteesPageClient from "./dictees-page-client";

export const metadata: Metadata = {
  title: "Liste des dictées | My Best French",
  description: "Choisis ta dictée et deviens un boss en Français",
};

export default function DicteesPage() {
  return <DicteesPageClient />;
}
