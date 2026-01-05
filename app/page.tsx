"use client";

import { ExerciseAttemptsChart } from "@/components/homepage/exercise-attempts-chart";
import { FavoriteDictationsSection } from "@/components/homepage/favorite-dictations-section";
import { Last7DaysStats } from "@/components/homepage/last-7-days-stats";
/* import { SplashCursor } from "@/components/ui/splash-cursor"; */

const BackgroundSnippet = () => {
  return (
    <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:6rem_4rem]">
      <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,#C9EBFF,transparent)]"></div>
    </div>
  );
};

export default function Home() {
  return (
    <>
      <div className="h-fit py-12 lg:py-0 lg:h-[calc(100vh-4rem)] flex items-center justify-center relative">
        <BackgroundSnippet />
        {/* <SplashCursor /> */}
        <div className="w-full mx-auto px-6 relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-center gap-6 pt-0 lg:pt-72 xl:pt-0">
          <div className="xl:w-fit w-full text-center mx-0">
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl shadow-2xl h-fit xl:h-[calc(100vh-12rem)] w-full xl:w-fit min-w-64">
              <Last7DaysStats />
            </div>
          </div>
          <div className="w-full mx-auto text-center hidden md:block">
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-16 shadow-2xl space-y-6 h-[calc(100vh-12rem)]">
              <ExerciseAttemptsChart />
            </div>
          </div>
        </div>
      </div>
      <div className="w-full px-6 py-8 ">
        <div className="p-0 xl:p-16 space-y-6 h-[calc(100vh-12rem)] z-90">
          <FavoriteDictationsSection />
        </div>
      </div>
    </>
  );
}
