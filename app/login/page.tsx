import type { Metadata } from "next";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = {
  title: "Me connecter à My Best French",
  description:
    "Connecte-toi à ton compte My Best French pour réviser ton français",
};

export default function Page() {
  return <LoginPageClient />;
}
