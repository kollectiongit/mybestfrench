import type { SerializedAttempt, SerializedProject } from "@/lib/writing/server";

export type Project = SerializedProject;
export type Attempt = SerializedAttempt;

export interface ProjectSummary {
  id: string;
  title: string | null;
  status: "planning" | "writing";
  min_words: number;
  draft_words: number;
  created_at: string;
  updated_at: string;
  attempts: { number: number; score: number; word_count: number; dictee_value: number; created_at: string }[];
}
