import { z } from "zod";

// ---------------------------------------------------------------------------
// Lesson & skills (stored on training_sheet)
// ---------------------------------------------------------------------------

export const LessonSectionSchema = z.object({
  heading: z.string(),
  points: z.array(z.string()),
  examples: z.array(z.string()),
});

export const LessonSchema = z.object({
  je_retiens: z.array(LessonSectionSchema),
  je_sais_faire: z.array(LessonSectionSchema),
});

export const SkillSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
});

export const EXERCISE_TYPES = [
  "choice",
  "fill_blanks",
  "mark_words",
  "classify",
  "label",
] as const;

export const ExerciseTypeSchema = z.enum(EXERCISE_TYPES);

export const ExerciseHintSchema = z.object({
  type: z.enum([...EXERCISE_TYPES, "other"]),
  description: z.string(),
});

export type Lesson = z.infer<typeof LessonSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type ExerciseType = z.infer<typeof ExerciseTypeSchema>;
export type ExerciseHint = z.infer<typeof ExerciseHintSchema>;

// ---------------------------------------------------------------------------
// What the LLM produces when reading the source (photo or text)
// ---------------------------------------------------------------------------

export const SourceAnalysisSchema = z.object({
  title: z.string(),
  category: z.object({
    existing_id: z.number().int().nullable(),
    new_name: z.string().nullable(),
  }),
  topic: z.object({
    existing_id: z.number().int().nullable(),
    new_name: z.string().nullable(),
  }),
  lesson: LessonSchema,
  skills: z.array(SkillSchema),
  exercise_hints: z.array(ExerciseHintSchema),
});

export type SourceAnalysis = z.infer<typeof SourceAnalysisSchema>;

// ---------------------------------------------------------------------------
// What the LLM produces when generating a session. Kept flat (no optional
// fields) so it maps to OpenAI structured outputs; normalized afterwards into
// the stored payloads below (see normalize.ts).
// ---------------------------------------------------------------------------

const ColorSchema = z.enum(["red", "green", "blue", "orange", "purple"]);

const ChoiceGenSchema = z.object({
  type: z.literal("choice"),
  title: z.string(),
  instruction: z.string(),
  questions: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(z.string()),
      correct_indexes: z.array(z.number().int()),
      skill_id: z.string(),
      explanation: z.string(),
    })
  ),
});

const FillBlanksGenSchema = z.object({
  type: z.literal("fill_blanks"),
  title: z.string(),
  instruction: z.string(),
  word_bank: z.array(z.string()),
  sentences: z.array(
    z.object({
      text: z.string(),
      blanks: z.array(
        z.object({
          answers: z.array(z.string()),
          skill_id: z.string(),
          explanation: z.string(),
        })
      ),
    })
  ),
});

const MarkWordsGenSchema = z.object({
  type: z.literal("mark_words"),
  title: z.string(),
  instruction: z.string(),
  legend: z.array(
    z.object({ key: z.string(), label: z.string(), color: ColorSchema })
  ),
  sentences: z.array(
    z.object({
      text: z.string(),
      targets: z.array(
        z.object({
          text: z.string(),
          key: z.string(),
          skill_id: z.string(),
          explanation: z.string(),
        })
      ),
    })
  ),
});

const ClassifyGenSchema = z.object({
  type: z.literal("classify"),
  title: z.string(),
  instruction: z.string(),
  categories: z.array(z.object({ key: z.string(), label: z.string() })),
  items: z.array(
    z.object({
      text: z.string(),
      category_key: z.string(),
      skill_id: z.string(),
      explanation: z.string(),
    })
  ),
});

const LabelGenSchema = z.object({
  type: z.literal("label"),
  title: z.string(),
  instruction: z.string(),
  options: z.array(z.object({ key: z.string(), label: z.string() })),
  items: z.array(
    z.object({
      text: z.string(),
      answer_key: z.string(),
      skill_id: z.string(),
      explanation: z.string(),
    })
  ),
});

export const ExerciseGenSchema = z.discriminatedUnion("type", [
  ChoiceGenSchema,
  FillBlanksGenSchema,
  MarkWordsGenSchema,
  ClassifyGenSchema,
  LabelGenSchema,
]);

export const SessionGenSchema = z.object({
  intro_message: z.string(),
  focus_skill_ids: z.array(z.string()),
  exercises: z.array(ExerciseGenSchema),
});

export type ExerciseGen = z.infer<typeof ExerciseGenSchema>;
export type SessionGen = z.infer<typeof SessionGenSchema>;

// ---------------------------------------------------------------------------
// End-of-session report (LLM writes the words, scores are computed in code)
// ---------------------------------------------------------------------------

export const SessionReportGenSchema = z.object({
  compris: z.array(z.string()),
  a_revoir: z.array(z.string()),
  message: z.string(),
  conseil: z.string(),
});

export type SessionReportGen = z.infer<typeof SessionReportGenSchema>;

// ---------------------------------------------------------------------------
// Stored payloads (training_exercise.payload), with stable ids for items
// ---------------------------------------------------------------------------

export type Color = z.infer<typeof ColorSchema>;

export interface Token {
  text: string;
  /** Whitespace before the token, so the sentence can be re-rendered. */
  pre: string;
  /** Only word tokens are clickable/markable. */
  word: boolean;
}

export interface ChoicePayload {
  type: "choice";
  title: string;
  instruction: string;
  questions: {
    id: string;
    prompt: string;
    options: string[];
    correct: number[];
    skill_id: string;
    explanation: string;
  }[];
}

export interface FillBlanksPayload {
  type: "fill_blanks";
  title: string;
  instruction: string;
  word_bank: string[];
  sentences: {
    id: string;
    /** Text around the blanks: parts.length === blanks.length + 1 */
    parts: string[];
    blanks: {
      id: string;
      answers: string[];
      skill_id: string;
      explanation: string;
    }[];
  }[];
}

export interface MarkWordsPayload {
  type: "mark_words";
  title: string;
  instruction: string;
  legend: { key: string; label: string; color: Color }[];
  sentences: {
    id: string;
    tokens: Token[];
    targets: {
      id: string;
      key: string;
      text: string;
      /** Inclusive token range */
      start: number;
      end: number;
      skill_id: string;
      explanation: string;
    }[];
  }[];
}

export interface ClassifyPayload {
  type: "classify";
  title: string;
  instruction: string;
  categories: { key: string; label: string }[];
  items: {
    id: string;
    text: string;
    category: string;
    skill_id: string;
    explanation: string;
  }[];
}

export interface LabelPayload {
  type: "label";
  title: string;
  instruction: string;
  options: { key: string; label: string }[];
  items: {
    id: string;
    text: string;
    answer: string;
    skill_id: string;
    explanation: string;
  }[];
}

export type ExercisePayload =
  | ChoicePayload
  | FillBlanksPayload
  | MarkWordsPayload
  | ClassifyPayload
  | LabelPayload;

// ---------------------------------------------------------------------------
// Grading results (training_answer.result), returned to the client as-is
// ---------------------------------------------------------------------------

export interface GradedUnit {
  skill_id: string;
  correct: boolean;
}

export type ItemResult =
  | {
      kind: "choice";
      selected: number[];
      correct: number[];
      is_correct: boolean;
      explanation: string;
      units: GradedUnit[];
    }
  | {
      kind: "fill_blanks";
      blanks: {
        id: string;
        given: string;
        expected: string;
        correct: boolean;
        explanation: string;
      }[];
      units: GradedUnit[];
    }
  | {
      kind: "mark_words";
      targets: {
        id: string;
        key: string;
        text: string;
        start: number;
        end: number;
        correct: boolean;
        explanation: string;
      }[];
      /** Word tokens marked although they belong to no target of that key */
      extras: number[];
      units: GradedUnit[];
    }
  | {
      kind: "classify" | "label";
      items: {
        id: string;
        given: string | null;
        expected: string;
        correct: boolean;
        explanation: string;
      }[];
      units: GradedUnit[];
    };

export interface SkillScore {
  correct: number;
  total: number;
}

export type SkillsResult = Record<string, SkillScore>;

export interface SessionReport extends SessionReportGen {
  score_20: number;
  items_correct: number;
  items_total: number;
  active_seconds: number;
}
