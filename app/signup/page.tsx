import type { Metadata } from "next";
import SignupPageClient from "./signup-page-client";

export const metadata: Metadata = {
  title: "Créer mon compte My Best French",
  description: "Crée ton compte My Best French pour réviser ton français",
};

export default function SignupPage() {
  return <SignupPageClient />;
}
