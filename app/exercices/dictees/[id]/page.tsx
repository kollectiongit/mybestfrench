import { Metadata } from "next";
import DicteeClient from "./dictee-client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Dictée | My Best French",
  description: "Prêt pour la dictée ?",
};

// Disable page caching and force dynamic rendering
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  const dictationId = Number(id);
  return <DicteeClient dictationId={dictationId} />;
}
