import { Metadata } from "next";
import DicteeClient from "./dictee-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Dictée | My Best French",
  description: "Prêt pour la dictée ?",
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <DicteeClient dictationId={id} />;
}
