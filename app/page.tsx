"use client";

import { ExerciseAttemptsChart } from "@/components/homepage/exercise-attempts-chart";
import { FavoriteDictationsSection } from "@/components/homepage/favorite-dictations-section";
import { WeekStats } from "@/components/homepage/last-7-days-stats";
import { PagesReadChart } from "@/components/homepage/pages-read-chart";
import { ReadingGoalWidget } from "@/components/homepage/reading-goal-widget";
import { TodosCompletionChart } from "@/components/homepage/todos-completion-chart";
import { TodosWeekStats } from "@/components/homepage/todos-week-stats";
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
      <div className="h-fit py-12 xl:py-0 xl:h-[calc(100vh-4rem)] flex items-center justify-center relative">
        <BackgroundSnippet />
        {/* <SplashCursor /> */}
        <div className="w-full mx-auto px-6 relative z-10 flex flex-col xl:flex-row xl:items-center xl:justify-center gap-6">
          <div className="xl:w-fit xl:h-[calc(100vh-12rem)] w-full text-center mx-0 gap-4 flex flex-row xl:flex-col">
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl shadow-2xl h-fit xl:h-1/2 w-full xl:w-fit md:px-4">
              <WeekStats week="current" title="Semaine actuelle" />
            </div>
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl shadow-2xl h-fit xl:h-1/2 w-full xl:w-fit md:px-4">
              <WeekStats week="previous" title="Semaine dernière" />
            </div>
          </div>
          <div className="xl:w-full w-full mx-auto text-center hidden md:block">
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-16 shadow-2xl space-y-6 h-[calc(100vh-12rem)]">
              <ExerciseAttemptsChart />
            </div>
          </div>
        </div>
      </div>
      <div className="w-full px-6 py-4 flex justify-center">
        <ReadingGoalWidget />
      </div>
      <div className="w-full px-6 py-8">
        <div className="hidden md:block">
          <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-16 shadow-2xl space-y-6 h-[calc(100vh-12rem)]">
            <PagesReadChart />
          </div>
        </div>
      </div>
      <div className="w-full px-6 py-8">
        <div className="w-full mx-auto flex flex-col xl:flex-row xl:items-stretch gap-6">
          <div className="w-full xl:w-fit text-center flex flex-row xl:flex-col gap-4">
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl shadow-2xl h-fit w-full xl:w-fit md:px-4">
              <TodosWeekStats week="current" title="To-Do — semaine actuelle" />
            </div>
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl shadow-2xl h-fit w-full xl:w-fit md:px-4">
              <TodosWeekStats week="previous" title="To-Do — semaine dernière" />
            </div>
          </div>
          <div className="flex-1 hidden md:block">
            <div className="bg-white/50 backdrop-blur-xl border-2 border-white/80 rounded-2xl p-16 shadow-2xl space-y-6 h-[calc(100vh-12rem)]">
              <TodosCompletionChart />
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
