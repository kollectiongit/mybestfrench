"use client";

import { Button } from "@/components/ui/button";
import { SplashCursor } from "@/components/ui/splash-cursor";
import { useCurrentProfile } from "@/hooks/use-current-profile";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

const BackgroundSnippet = () => {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]"></div>
    </div>
  );
};

export default function Home() {
  const { profile, isLoading } = useCurrentProfile();

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center relative">
        <BackgroundSnippet />
        <SplashCursor />
        <div className="text-center relative z-10"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex items-center justify-center relative">
      <BackgroundSnippet />
      <SplashCursor />
      <div className="w-2xl mx-auto text-center px-6 relative z-10">
        <div className="bg-white/60 backdrop-blur-xl border border-white/30 rounded-2xl p-16 shadow-2xl space-y-6">
          <h1 className="text-4xl font-bold text-gray-900">
            👋 Salut {profile?.first_name || ""}
          </h1>

          <p className="text-xl text-gray-600">
            {profile
              ? "Prêt pour une petite dictée 🤓 ?"
              : "Connectez-vous pour commencer vos dictées"}
          </p>

          <div className="pt-4">
            <Link href={profile ? "/exercices/dictees" : "/login"}>
              <Button
                size="lg"
                className="w-full group cursor-pointer transition-all duration-300 ease-in-out hover:scale-105 hover:text-white hover:bg-gradient-to-r hover:from-purple-500 hover:via-pink-500 hover:to-orange-400"
              >
                <span className="flex items-center justify-center gap-2">
                  {profile ? "Commencer" : "Me connecter"}
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-in-out group-hover:translate-x-1" />
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
