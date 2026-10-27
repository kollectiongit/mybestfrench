import type { PublicPayload } from "@/lib/training/exercises";
import type { ItemResult, Lesson, SessionReport, Skill, SkillsResult } from "@/lib/training/schema";

export type { ItemResult, Lesson, PublicPayload, SessionReport, Skill, SkillsResult };

export interface TopicEntry {
  id: number;
  name: string;
  slug: string;
  dictations_count: number;
  sheets_count: number;
  in_use: boolean;
}

export interface CategoryEntry {
  id: number;
  name: string;
  slug: string;
  topics: TopicEntry[];
}

export interface SheetSummary {
  id: number;
  title: string;
  source_type: string;
  cover_image: string | null;
  category: { id: number; name: string };
  topic: { id: number; name: string };
  sessions_count: number;
  last_score: number | null;
  best_score: number | null;
  last_session_at: string | null;
  in_progress_session_id: string | null;
}

export interface AnswerEntry {
  answer: unknown;
  result: ItemResult;
}

export interface SessionExercise {
  id: number;
  position: number;
  type: PublicPayload["type"];
  status: string;
  items_total: number;
  items_correct: number;
  item_keys: string[];
  payload: PublicPayload;
  answers: Record<string, AnswerEntry>;
}

export interface SessionData {
  id: string;
  status: "in_progress" | "completed" | "abandoned";
  started_at: string;
  completed_at: string | null;
  active_seconds: number;
  score_20: number | null;
  items_total: number;
  items_correct: number;
  plan: { intro_message: string; focus_skill_ids: string[] } | null;
  report: SessionReport | null;
  skills_result: SkillsResult | null;
  voice_name: string | null;
  sheet: {
    id: number;
    title: string;
    category: string;
    topic: string;
    lesson: Lesson;
    skills: Skill[];
  };
  exercises: SessionExercise[];
}

export type AnswerHandler = (itemKey: string, answer: unknown) => Promise<void>;
