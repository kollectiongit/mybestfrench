import { OPENAI_MODEL } from "@/lib/ai-models";
import { auth } from "@/lib/auth";
import { compareDictation, DictationComparison } from "@/lib/dictation-diff";
import {
  DicteeAnalysis,
  DicteeExplanations,
  DicteeExplanationsSchema,
} from "@/lib/dictation-schema";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

// Force dynamic rendering due to request.headers usage
export const dynamic = 'force-dynamic';

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

type ErrorType = "orthographe" | "grammaire" | "conjugaison";

// Extracts a completed top-level string field from the JSON being streamed
function extractStringField(jsonText: string, field: string): string | null {
  const match = jsonText.match(
    new RegExp(`"${field}":\\s*("(?:[^"\\\\]|\\\\.)*")`)
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function boldWords(text: string): string {
  return text
    .split(" ")
    .map((word) => `**${word}**`)
    .join(" ");
}

function defaultExplanation(error: { expected: string; written: string }) {
  if (!error.written) return `Tu as oublié *${error.expected}*.`;
  if (!error.expected) return `**${error.written}** est en trop.`;
  return `Tu as écrit **${error.written}** au lieu de *${error.expected}*.`;
}

// Merges the deterministic comparison with the LLM explanations
function buildAnalysis(
  comparison: DictationComparison,
  explanations: DicteeExplanations | null,
  originalText: string
): DicteeAnalysis {
  const byId = new Map(explanations?.explications.map((e) => [e.id, e]));

  const errors = comparison.errors.map((error) => {
    const explanation = byId.get(error.id);
    return {
      order: error.id,
      wrong: error.written ? boldWords(error.written) : "_(oublié)_",
      right: error.expected ? `*${error.expected}*` : "_(en trop)_",
      type: (explanation?.type ?? "orthographe") as ErrorType,
      explication: explanation?.explication || defaultExplanation(error),
    };
  });

  const asList = (items: string[]) =>
    items.length === 1 ? items[0] : items.map((item) => `- ${item}`).join("\n");

  const fautes = comparison.sentences.map((sentence) => {
    const sentenceErrors = errors.filter((e) =>
      sentence.errorIds.includes(e.order)
    );
    const rules = [
      ...new Set(
        sentenceErrors.map((e) => byId.get(e.order)?.regle).filter(Boolean)
      ),
    ] as string[];
    return {
      sentence_order_number: sentence.index + 1,
      texte_eleve: sentence.studentHighlighted,
      correction: sentence.originalHighlighted,
      explication: asList(sentenceErrors.map((e) => e.explication)),
      regle: rules.length > 0 ? asList(rules) : "Relis bien chaque mot et apprends son orthographe.",
    };
  });

  const countType = (type: ErrorType) =>
    errors.filter((e) => e.type === type).length;

  return {
    stats: {
      total_fautes: errors.length,
      fautes_orthographe: countType("orthographe"),
      fautes_grammaire: countType("grammaire"),
      fautes_conjugaison: countType("conjugaison"),
      pourcentage_reussite: comparison.successPercentage,
    },
    dictation_submitted_errors_highlighted: comparison.studentHighlighted,
    original_text_errors_highlighted: comparison.originalHighlighted,
    message_general:
      explanations?.message_general ||
      (errors.length === 0 ? "Bravo, aucune faute !" : "Voici la correction de ta dictée."),
    errors,
    fautes,
    conclusion_positive:
      explanations?.conclusion_positive ||
      "Continue tes efforts, tu progresses bien !",
    originalText,
  };
}

export async function POST(request: NextRequest) {
  try {
    // Ensure OpenAI API key is configured
    if (!process.env["OPENAI_API_KEY"]) {
      console.error("OPENAI_API_KEY is not set in environment");
      return NextResponse.json(
        { error: "Server configuration error: missing OpenAI API key" },
        { status: 500 }
      );
    }

    // Get session from BetterAuth
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current profile ID from cookie
    const currentProfileId = await getCurrentProfileFromCookie(request);

    if (!currentProfileId) {
      return NextResponse.json({ error: "No profile selected" }, { status: 400 });
    }

    // Verify the profile belongs to the user
    const profile = await prisma.profiles.findFirst({
      where: {
        id: currentProfileId,
        user_id: session.user.id,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      dictationId: incomingDictationId,
      studentText,
      originalText,
      profileAge,
      profileFirstName,
      profileDescription,
      profileLevels
    } = body;

    const dictationId = Number(incomingDictationId);

    if (!incomingDictationId || Number.isNaN(dictationId) || !studentText || !originalText || !profileAge) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const perfect = await prisma.exercices_attempts.findFirst({
      where: {
        profile_id: currentProfileId,
        dictation_id: dictationId,
        correction_success_percentage: 100,
      },
      select: { id: true },
    });
    if (perfect) {
      return NextResponse.json(
        { error: "Cette dictée a déjà obtenu 10/10 et ne peut plus être re-soumise." },
        { status: 403 }
      );
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const todayCount = await prisma.exercices_attempts.count({
      where: {
        profile_id: currentProfileId,
        dictation_id: dictationId,
        created_at: { gte: startOfToday, lt: endOfToday },
      },
    });
    if (todayCount >= 3) {
      return NextResponse.json(
        { error: "Cette dictée a déjà été effectuée 3 fois aujourd'hui." },
        { status: 403 }
      );
    }

    // Errors, score and highlighting are computed in code, not by the LLM
    const comparison = compareDictation(originalText, studentText);
    const preliminaryAnalysis = buildAnalysis(comparison, null, originalText);

    const studentName = profileFirstName || "ton élève";

    // System prompt with dynamic profile information
    const systemPrompt = `Tu es un professeur d'école élémentaire (niveaux : ${profileLevels || 'école élémentaire'}).
Ton rôle est d'aider ton élève à progresser en orthographe, grammaire et conjugaison à travers la correction de ses dictées.

# Règles générales
- Tu corriges avec bienveillance et pédagogie.
- Tu gardes un ton **décontracté et proche de l'enfant**, avec de temps en temps une petite blague ou comparaison amusante pour rendre l'apprentissage plus fun.
- Tu expliques chaque faute en **termes simples**, adaptés à un enfant de ${profileAge} ans.
- Tu t'adresses directement à l'élève, en utilisant son prénom ${profileFirstName || 'non renseigné'} et en le tutoyant.
- Tu fais des réponses personnalisées en fonction de la présentation de l'élève et de son niveau.

# Profil de l'élève
- Prénom : ${profileFirstName || 'non renseigné'}
- Âge : ${profileAge} ans
- Niveaux : ${profileLevels || 'CE1 à CM2'}
- Présentation : ${profileDescription || 'Élève motivé et curieux'}
`;

    const errorsList =
      comparison.errors.length === 0
        ? "Aucune erreur : la dictée est parfaite."
        : comparison.errors
            .map(
              (error) =>
                `- id ${error.id} : attendu « ${error.expected || "(rien, mot en trop)"} », ${studentName} a écrit « ${error.written || "(rien, mot oublié)"} »`
            )
            .join("\n");

    const userPrompt = `# Dictée donnée à l'élève (réponse correcte)
${originalText}

# Copie de l'élève
${studentText}

# Erreurs détectées
La comparaison mot à mot a déjà été faite. Voici la liste EXACTE et COMPLÈTE des erreurs (${comparison.errors.length} erreur(s), ${comparison.correctWords} mot(s) correct(s) sur ${comparison.totalWords}) :
${errorsList}

Les erreurs de ponctuation, de majuscules et d'apostrophes ont déjà été ignorées.
N'ajoute AUCUNE autre erreur, n'en retire aucune et ne recompte rien : tous les autres mots sont corrects.

# Tâches
1. "message_general" : une phrase d'accueil courte et personnalisée pour ${studentName}, cohérente avec le nombre d'erreurs ci-dessus.
2. "explications" : exactement un élément par erreur de la liste, avec le même "id" :
   - "type" : "orthographe", "grammaire" (accords, homophones grammaticaux comme a/à, et/est…) ou "conjugaison"
   - "explication" : explication courte et simple. Mets en **gras** ce que l'élève a écrit et en *italique* la bonne réponse (ex : Tu as écrit **bein** au lieu de *bains*.)
   - "regle" : la règle expliquée simplement, avec en **gras** les mots ou lettres importants
   Si la liste est vide, renvoie un tableau vide.
3. "conclusion_positive" : 1 à 3 phrases encourageantes et motivantes pour ${studentName}. Tu peux utiliser **gras**, mais pas de titres ni de listes.`;

    const encoder = new TextEncoder();
    const send = (
      controller: ReadableStreamDefaultController<Uint8Array>,
      payload: unknown
    ) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

    // Return SSE stream
    return new Response(
      new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            // Score and highlighting are known before the LLM answers
            send(controller, {
              type: "delta",
              partial: {
                stats: preliminaryAnalysis.stats,
                dictation_submitted_errors_highlighted:
                  preliminaryAnalysis.dictation_submitted_errors_highlighted,
                original_text_errors_highlighted:
                  preliminaryAnalysis.original_text_errors_highlighted,
                errors: preliminaryAnalysis.errors,
              },
            });

            let explanations: DicteeExplanations | null = null;
            try {
              let accumulatedText = "";
              const stream = client.responses.stream({
                model: OPENAI_MODEL,
                input: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt },
                ],
                text: {
                  format: zodTextFormat(DicteeExplanationsSchema, "dictee_explanations"),
                },
              });

              stream.on("response.output_text.delta", (event) => {
                accumulatedText += event.delta;
                const partial: Record<string, string> = {};
                for (const field of ["message_general", "conclusion_positive"]) {
                  const value = extractStringField(accumulatedText, field);
                  if (value) partial[field] = value;
                }
                if (Object.keys(partial).length > 0) {
                  send(controller, { type: "delta", partial });
                }
              });

              const finalResponse = await stream.finalResponse();
              if (finalResponse.status === "completed") {
                const parsed = DicteeExplanationsSchema.safeParse(
                  JSON.parse(finalResponse.output_text)
                );
                if (parsed.success) {
                  explanations = parsed.data;
                } else {
                  console.error("Zod validation error:", parsed.error);
                }
              } else {
                console.error("Incomplete LLM response:", finalResponse.status);
              }
            } catch (llmError) {
              // The correction stays valid without the explanations
              console.error("Error while generating explanations:", llmError);
            }

            const analysis = buildAnalysis(comparison, explanations, originalText);
            let exerciceAttempt: Awaited<
              ReturnType<typeof prisma.exercices_attempts.create>
            > | null = null;

            // Save the analysis results to the database
            try {
              exerciceAttempt = await prisma.exercices_attempts.create({
                data: {
                  user_id: session.user.id,
                  profile_id: currentProfileId,
                  dictation_id: dictationId,
                  question_type: "DICTEE",
                  question_text: originalText,
                  user_answer: studentText,
                  is_correct: analysis.stats.total_fautes === 0,
                  correction_total_errors: analysis.stats.total_fautes,
                  correction_errors_spelling: analysis.stats.fautes_orthographe,
                  correction_errors_grammar: analysis.stats.fautes_grammaire,
                  correction_errors_conjugation: analysis.stats.fautes_conjugaison,
                  correction_success_percentage: analysis.stats.pourcentage_reussite,
                  correction_greeting_message: analysis.message_general,
                  correction_errors_by_sentence_json: analysis.fautes,
                  correction_conclusion_message: analysis.conclusion_positive,
                  correction_full_json: JSON.stringify(analysis),
                  correction_user_answer_errors_highlighted:
                    analysis.dictation_submitted_errors_highlighted,
                  original_text_errors_highlighted:
                    analysis.original_text_errors_highlighted,
                },
              });

              console.log("Exercise attempt saved to database:", exerciceAttempt.id);

              // Save individual errors to database
              if (analysis.errors.length > 0) {
                await prisma.exercices_errors.createMany({
                  data: analysis.errors.map((error) => ({
                    user_id: session.user.id,
                    profile_id: currentProfileId,
                    attempt_id: exerciceAttempt!.id,
                    dictation_id: dictationId,
                    wrong_text: error.wrong,
                    right_text: error.right,
                    error_type: error.type,
                    explication: error.explication,
                  })),
                });
                console.log(`Saved ${analysis.errors.length} errors to database`);
              }

              // Invalidate cache for this dictation and profile
              try {
                // Match tags used in GET /api/dictations/[id] and list endpoint
                revalidateTag('dictation');
                revalidateTag('dictations');
                revalidateTag(`dictation-${dictationId}`);
                revalidateTag(`profile-${currentProfileId}`);
                console.log("Cache invalidated for dictation:", dictationId);
              } catch (cacheError) {
                console.error("Error invalidating cache:", cacheError);
              }
            } catch (dbError) {
              console.error("Error saving to database:", dbError);
              // Continue with the response even if database save fails
            }

            send(controller, {
              type: "complete",
              analysis,
              attempt: exerciceAttempt,
            });
          } catch (error) {
            console.error("Error in streaming:", error);
            send(controller, {
              type: "error",
              error: "Failed to analyze dictation",
            });
          } finally {
            controller.close();
          }
        }
      }),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      }
    );

  } catch (error) {
    console.error("Error in dictation validation:", error);
    return NextResponse.json(
      { error: "Failed to analyze dictation" },
      { status: 500 }
    );
  }
}
