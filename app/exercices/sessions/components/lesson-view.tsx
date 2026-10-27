"use client";

import { cn } from "@/lib/utils";
import type { Lesson } from "../types";
import { Md } from "./shared";

type Section = Lesson["je_retiens"][number];

function LessonBlock({
  title,
  sections,
  tone,
}: {
  title: string;
  sections: Section[];
  tone: "rose" | "amber";
}) {
  if (sections.length === 0) return null;
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        tone === "rose" ? "border-rose-200 bg-rose-50/60" : "border-amber-200 bg-amber-50/60"
      )}
    >
      <div
        className={cn(
          "mb-3 inline-block rounded-md px-3 py-1 text-sm font-bold text-white",
          tone === "rose" ? "bg-rose-500" : "bg-amber-500"
        )}
      >
        {title}
      </div>
      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={i} className="space-y-1.5">
            <h4 className="font-semibold text-gray-900">{section.heading}</h4>
            <ul className="space-y-1 pl-1">
              {section.points.map((point, j) => (
                <li key={j} className="flex gap-2 text-sm text-gray-800">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-3 shrink-0 rounded-full",
                      tone === "rose" ? "bg-rose-400" : "bg-amber-400"
                    )}
                  />
                  <Md>{point}</Md>
                </li>
              ))}
            </ul>
            {section.examples.length > 0 && (
              <div className="space-y-0.5 pl-5 text-sm italic text-gray-600">
                {section.examples.map((ex, j) => (
                  <div key={j}>
                    <Md>{ex}</Md>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LessonView({ lesson, className }: { lesson: Lesson; className?: string }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", className)}>
      <LessonBlock title="Je retiens" sections={lesson.je_retiens} tone="rose" />
      <LessonBlock title="Je sais faire" sections={lesson.je_sais_faire} tone="amber" />
    </div>
  );
}
