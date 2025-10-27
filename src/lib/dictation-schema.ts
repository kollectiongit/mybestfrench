import { z } from "zod";

export const DicteeAnalysisSchema = z.object({
  stats: z.object({
    total_fautes: z.number().int(),
    fautes_orthographe: z.number().int(),
    fautes_grammaire: z.number().int(),
    fautes_conjugaison: z.number().int(),
    // Use a number 0-100 (easier than "83%")
    pourcentage_reussite: z.number().min(0).max(100),
  }),
  dictation_submitted_errors_highlighted: z.string().nullable(),
  original_text_errors_highlighted: z.string().nullable(),
  message_general: z.string(),
  errors: z.array(
    z.object({
      order: z.number().int(),
      wrong: z.string(),
      right: z.string(),
      type: z.enum(["orthographe", "grammaire", "conjugaison"]),
      explication: z.string(),
    })
  ),
  fautes: z.array(
    z.object({
      sentence_order_number: z.number().int(),
      texte_eleve: z.string(),
      correction: z.string(),
      explication: z.string(),
      regle: z.string(),
    })
  ),
  conclusion_positive: z.string(),
  originalText: z.string().nullable(),
});

export type DicteeAnalysis = z.infer<typeof DicteeAnalysisSchema>;
