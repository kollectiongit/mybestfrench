import { z } from "zod";

// AI outputs of the expression écrite (Structured Outputs: every field required,
// optional values are nullable).

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const OutlineSchema = z.object({
  title: z.string().describe("Titre court du sujet, trouvé avec l'élève"),
  outline: z
    .string()
    .describe(
      "La trame en markdown simple : un court résumé de l'histoire adressé à l'élève, comment démarrer, puis « **Idées à raconter :** » et quelques suggestions avec des tirets. Les idées choisies avec l'élève, complétées si besoin."
    ),
});
export type OutlineGen = z.infer<typeof OutlineSchema>;

export const ERROR_TYPES = ["orthographe", "grammaire", "conjugaison", "vocabulaire", "ponctuation"] as const;
export type WritingErrorType = (typeof ERROR_TYPES)[number];

export const CorrectionSchema = z.object({
  greeting: z.string().describe("2 phrases chaleureuses qui résument le travail"),
  scores: z.object({
    global: z.number().int().min(0).max(100),
    spelling: z.number().int().min(0).max(100),
    grammar: z.number().int().min(0).max(100),
    conjugation: z.number().int().min(0).max(100),
    vocabulary: z.number().int().min(0).max(100),
  }),
  errors: z.array(
    z.object({
      type: z.enum(ERROR_TYPES),
      context_before: z
        .string()
        .describe("Les 1 à 4 mots qui précèdent l'erreur, recopiés exactement (\"\" en début de texte)"),
      wrong: z.string().describe("Le passage fautif recopié EXACTEMENT comme l'élève l'a écrit, le plus court possible"),
      correction: z.string().describe("Le passage corrigé"),
      explanation: z.string().describe("Pourquoi c'est une erreur : la règle en 1 ou 2 phrases simples, avec une astuce"),
    })
  ),
  corrected_text: z.string().describe("La copie de l'élève avec uniquement les fautes corrigées"),
  improved_text: z
    .string()
    .describe("La copie réécrite avec un vocabulaire plus riche et des phrases plus élaborées, en gardant les idées de l'élève"),
  improvements: z.array(
    z.object({
      original: z.string().describe("Passage de l'élève (corrigé)"),
      improved: z.string().describe("Passage enrichi"),
      why: z.string().describe("Ce que l'enrichissement apporte, en une phrase"),
    })
  ),
  strengths: z.array(z.string()).describe("Ce qui est bien réussi"),
  weaknesses: z.array(z.string()).describe("Ce qui est moins réussi"),
  to_work: z.array(
    z.object({
      label: z.string().describe("Le point à travailler, lisible par un enfant (ex. « L'accord du participe passé avec être »)"),
      details: z
        .string()
        .describe("Pour le professeur qui préparera des exercices : la notion, les erreurs de l'élève qui s'y rapportent"),
    })
  ),
  outline_feedback: z.string().describe("Respect de la trame, créativité et organisation du récit, en 1 à 3 phrases"),
});
export type CorrectionGen = z.infer<typeof CorrectionSchema>;

/** Student text split around located errors (index into `errors`). */
export interface Segment {
  text: string;
  error: number | null;
}

export interface Correction extends Omit<CorrectionGen, "scores"> {
  segments: Segment[];
}
