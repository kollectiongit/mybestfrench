"use client";

import { SpeakButton } from "@/components/speak-button";
import { cn } from "@/lib/utils";
import { Lightbulb, Wrench } from "lucide-react";
import type { Lesson } from "../types";
import { Md } from "./shared";

type Section = Lesson["je_retiens"][number];

const TONES = {
  rose: {
    card: "border-rose-200 bg-rose-50/50",
    badge: "bg-rose-500",
    bullet: "bg-rose-400",
    example: "border-rose-300",
  },
  amber: {
    card: "border-amber-200 bg-amber-50/50",
    badge: "bg-amber-500",
    bullet: "bg-amber-400",
    example: "border-amber-300",
  },
} as const;

function LessonBlock({
  title,
  icon: Icon,
  sections,
  tone,
}: {
  title: string;
  icon: typeof Lightbulb;
  sections: Section[];
  tone: keyof typeof TONES;
}) {
  if (sections.length === 0) return null;
  const t = TONES[tone];
  return (
    <section className={cn("rounded-2xl border p-5 sm:p-7", t.card)}>
      <div className={cn("mb-5 inline-flex items-center gap-2 rounded-lg px-3 py-1.5 font-bold text-white", t.badge)}>
        <Icon className="size-4" /> {title}
      </div>
      <div className="space-y-7">
        {sections.map((section, i) => (
          <div key={i} className="space-y-3">
            <h4 className="flex items-center gap-1.5 text-lg font-bold text-gray-900">
              {section.heading}
              <SpeakButton
                label="Écouter la règle"
                text={[section.heading, ...section.points, ...section.examples].join(". ")}
              />
            </h4>
            <ul className="space-y-2.5">
              {section.points.map((point, j) => (
                <li key={j} className="flex gap-3 text-base leading-relaxed text-gray-800">
                  <span className={cn("mt-2.5 h-1.5 w-3 shrink-0 rounded-full", t.bullet)} />
                  <Md highlight>{point}</Md>
                </li>
              ))}
            </ul>
            {section.examples.length > 0 && (
              <div className="flex flex-wrap gap-2 pl-6">
                {section.examples.map((ex, j) => (
                  <span
                    key={j}
                    className={cn(
                      "rounded-lg border-l-4 bg-white px-3 py-1.5 text-[15px] italic text-gray-700 shadow-xs",
                      t.example
                    )}
                  >
                    <Md>{ex}</Md>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Je retiens" then "Je sais faire", one under the other. */
export function LessonView({ lesson, className }: { lesson: Lesson; className?: string }) {
  return (
    <div className={cn("space-y-5", className)}>
      <LessonBlock title="Je retiens" icon={Lightbulb} sections={lesson.je_retiens} tone="rose" />
      <LessonBlock title="Je sais faire" icon={Wrench} sections={lesson.je_sais_faire} tone="amber" />
    </div>
  );
}
