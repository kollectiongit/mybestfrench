import { isUserAuthenticated } from "@/lib/current-profile";
import type { Metadata } from "next";
import SessionClient from "./session-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Session d'exercices | My Best French",
};

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const isAuthenticated = await isUserAuthenticated();
  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center text-gray-500">
        Veuillez vous connecter pour accéder à vos exercices.
      </div>
    );
  }

  const { sessionId } = await params;
  return <SessionClient key={sessionId} sessionId={sessionId} />;
}
