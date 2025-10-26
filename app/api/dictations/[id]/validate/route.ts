import { auth } from "@/lib/auth";
import { DicteeAnalysisSchema } from "@/lib/dictation-schema";
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

// Helper function to extract partial fields from incomplete JSON
function extractPartialFields(jsonText: string): Partial<{
  stats: {
    total_fautes: number;
    fautes_orthographe: number;
    fautes_grammaire: number;
    fautes_conjugaison: number;
    pourcentage_reussite: number;
  };
  message_general: string;
  fautes: Array<{
    sentence_order_number: number;
    texte_eleve: string;
    correction: string;
    explication: string;
    regle: string;
  }>;
  conclusion_positive: string;
}> {
  const partial: Record<string, unknown> = {};
  
  try {
    // Try to extract stats object
    const statsMatch = jsonText.match(/"stats":\s*\{[^}]*\}/);
    if (statsMatch) {
      const statsStr = statsMatch[0].replace(/"stats":\s*/, '');
      try {
        partial.stats = JSON.parse(statsStr);
      } catch {}
    }
    
    // Try to extract message_general
    const messageMatch = jsonText.match(/"message_general":\s*"([^"]*(?:\\.[^"]*)*)"/);
    if (messageMatch) {
      partial.message_general = messageMatch[1];
    }
    
    // Try to extract conclusion_positive
    const conclusionMatch = jsonText.match(/"conclusion_positive":\s*"([^"]*(?:\\.[^"]*)*)"/);
    if (conclusionMatch) {
      partial.conclusion_positive = conclusionMatch[1];
    }
    
    // Try to extract fautes array (simplified - just check if it exists)
    const fautesMatch = jsonText.match(/"fautes":\s*\[/);
    if (fautesMatch) {
      // Try to extract complete faute objects
      const fauteObjects = [];
      const fauteRegex = /\{[^}]*"sentence_order_number"[^}]*\}/g;
      let match;
      while ((match = fauteRegex.exec(jsonText)) !== null) {
        try {
          const faute = JSON.parse(match[0]);
          if (faute.sentence_order_number && faute.texte_eleve && faute.correction) {
            fauteObjects.push(faute);
          }
        } catch {}
      }
      if (fauteObjects.length > 0) {
        partial.fautes = fauteObjects;
      }
    }
  } catch {
    // Ignore parsing errors
  }
  
  return partial;
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

    // System prompt with dynamic profile information
    const systemPrompt = `Tu es un professeur d'école élémentaire (niveaux : ${profileLevels || 'école élémentaire'}).  
Ton rôle est d'aider ton élève à progresser en orthographe, grammaire et conjugaison à travers la correction et l'analyse de ses dictées.  

# Règles générales
- Tu corriges avec bienveillance et pédagogie.  
- Tu gardes un ton **décontracté et proche de l'enfant**, avec toujours une petite blague ou comparaison amusante pour rendre l'apprentissage plus fun.  
- Tu expliques chaque faute en **termes simples**, adaptés à un enfant de ${profileAge} ans.  
- Tu donnes toujours la **règle associée** pour que l'élève comprenne et progresse.  
- Tu t'adresses directement à l'élève, en utilisant son prénom ${profileFirstName || 'non renseigné'} et en le tutoyant.
- Tu fais des réponses personnalisées en fonction de la présentation de l'élève et de son niveau.
- Tu rédiges ta réponse en **Markdown**, structurée avec titres (#), sous-titres (##), listes à puce (- ), listes numériques (1.), gras (**bold**), italique (*italic*).  
- Ta réponse doit toujours finir par une **conclusion positive et motivante**.  

# Profil de l'élève
- Prénom : ${profileFirstName || 'non renseigné'}
- Âge : ${profileAge} ans
- Niveaux : ${profileLevels || 'CE1 à CM2'}
- Présentation : ${profileDescription || 'Élève motivé et curieux'}




`;

    const userPrompt = `# Dictée donnée à l'élève (réponse correcte)
    ${originalText}

    # Copie de l'élève
    ${studentText}

    # Tâches
    1. Analyse la copie de l'élève et la compare à la dictée correcte.

    2. Donne un **bilan global** :
      - Nombre total de fautes  
      - Répartition : fautes d'orthographe / de grammaire / de conjugaison  
      - % de mots bien orthographiés  

    3. Analyse **chaque faute** en regroupant par phrase :
      - a. Ce que ${profileFirstName || 'ton élève'} a écrit  
      - b. La bonne correction  
      - c. Pourquoi c'est une faute  
      - d. La règle expliquée simplement  

    4. Termine par une **conclusion encourageante** pour motiver ${profileFirstName || 'ton élève'}.
    
    Analyse cette dictée selon les instructions données et réponds en JSON avec la structure exacte demandée.`;

    // Create streaming response
    const stream = client.responses.stream({
      model: "gpt-4.1-mini", // Supported model for Structured Outputs
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: zodTextFormat(DicteeAnalysisSchema, "dictee_analysis"),
      },
    });

    // Return SSE stream
    return new Response(
      new ReadableStream({
        async start(controller) {
          let accumulatedText = "";
          let validatedResult: {
            stats: {
              total_fautes: number;
              fautes_orthographe: number;
              fautes_grammaire: number;
              fautes_conjugaison: number;
              pourcentage_reussite: number;
            };
            message_general: string;
            fautes: Array<{
              sentence_order_number: number;
              texte_eleve: string;
              correction: string;
              explication: string;
              regle: string;
            }>;
            conclusion_positive: string;
          } | null = null;
          let exerciceAttempt: unknown = null;
          
          try {
            stream
              .on("response.output_text.delta", (event) => {
                accumulatedText += event.delta;
                
                // Try to parse partial JSON and extract available fields
                try {
                  const partial = JSON.parse(accumulatedText);
                  // Send progressive update with parsed fields
                  controller.enqueue(`data: ${JSON.stringify({ 
                    type: "delta", 
                    partial: partial
                  })}\n\n`);
                } catch {
                  // If JSON is incomplete, try to extract partial fields manually
                  const partialFields = extractPartialFields(accumulatedText);
                  if (Object.keys(partialFields).length > 0) {
                    controller.enqueue(`data: ${JSON.stringify({ 
                      type: "delta", 
                      partial: partialFields
                    })}\n\n`);
                  }
                }
              })
              .on("response.refusal.delta", (event) => {
                controller.enqueue(`data: ${JSON.stringify({ 
                  type: "refusal", 
                  refusal: event.delta 
                })}\n\n`);
              })
              .on("event", (event: { type: string; error?: unknown }) => {
                if (event.type === "response.error") {
                  console.error("Stream error:", event.error);
                  controller.enqueue(`data: ${JSON.stringify({ 
                    type: "error", 
                    error: event.error 
                  })}\n\n`);
                  controller.close();
                }
              });

            // Wait for the final response
            const finalResponse = await stream.finalResponse();
            
            if (finalResponse.status === "completed") {
              // Parse and validate the complete result
              let parsedResult: unknown = null;
              try {
                parsedResult = JSON.parse(finalResponse.output_text);
                validatedResult = DicteeAnalysisSchema.parse(parsedResult);
              } catch (error) {
                console.error("Zod validation error:", error);
                
                // Try to fix missing fields - ensure all required fields are present
                const parsed = parsedResult as Record<string, unknown>;
                const fixedResult = {
                  stats: parsed?.stats || parsed?.bilan_global || {
                    total_fautes: 0,
                    fautes_orthographe: 0,
                    fautes_grammaire: 0,
                    fautes_conjugaison: 0,
                    pourcentage_reussite: 100
                  },
                  message_general: parsed?.message_general || "Analyse terminée",
                  fautes: (Array.isArray(parsed?.fautes) ? parsed.fautes : []).map((faute: Record<string, unknown>, index: number) => ({
                    sentence_order_number: faute.sentence_order_number || index + 1,
                    texte_eleve: faute.texte_eleve || faute.texte_noa || "Texte non disponible",
                    correction: faute.correction || "Correction non disponible",
                    explication: faute.explication || "Je n'ai pas d'explication à te fournir",
                    regle: faute.regle || "Il n'y a pas de règle spécifique"
                  })),
                  conclusion_positive: parsed?.conclusion_positive || "Continue tes efforts, tu progresses bien !"
                };
                
                try {
                  validatedResult = DicteeAnalysisSchema.parse(fixedResult);
                } catch (secondError) {
                  console.error("Second validation error:", secondError);
                  // If still failing, create a minimal valid result
                  validatedResult = {
                    stats: {
                      total_fautes: 0,
                      fautes_orthographe: 0,
                      fautes_grammaire: 0,
                      fautes_conjugaison: 0,
                      pourcentage_reussite: 100
                    },
                    message_general: "Analyse terminée",
                    fautes: [],
                    conclusion_positive: "Continue tes efforts, tu progresses bien !"
                  };
                }
              }

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
                    is_correct: validatedResult.stats.total_fautes === 0,
                    correction_total_errors: validatedResult.stats.total_fautes,
                    correction_errors_spelling: validatedResult.stats.fautes_orthographe,
                    correction_errors_grammar: validatedResult.stats.fautes_grammaire,
                    correction_errors_conjugation: validatedResult.stats.fautes_conjugaison,
                    correction_success_percentage: validatedResult.stats.pourcentage_reussite,
                    correction_greeting_message: validatedResult.message_general,
                    correction_errors_by_sentence_json: validatedResult.fautes,
                    correction_conclusion_message: validatedResult.conclusion_positive,
                    correction_full_json: JSON.stringify(validatedResult),
                  },
                });

                console.log("Exercise attempt saved to database:", (exerciceAttempt as { id: number }).id);
                
                // Invalidate cache for this dictation and profile
                try {
                  revalidateTag('dictations');
                  revalidateTag(`dictation-${dictationId}`);
                  if (currentProfileId) {
                    revalidateTag(`profile-${currentProfileId}`);
                  }
                  console.log("Cache invalidated for dictation:", dictationId);
                } catch (cacheError) {
                  console.error("Error invalidating cache:", cacheError);
                }
              } catch (dbError) {
                console.error("Error saving to database:", dbError);
                // Continue with the response even if database save fails
              }

              // Send completion event with originalText included
              controller.enqueue(`data: ${JSON.stringify({ 
                type: "complete", 
                analysis: {
                  ...validatedResult,
                  originalText: originalText
                },
                attempt: exerciceAttempt
              })}\n\n`);
            } else {
              // Handle incomplete response
              controller.enqueue(`data: ${JSON.stringify({ 
                type: "error", 
                error: "Response incomplete" 
              })}\n\n`);
            }
          } catch (error) {
            console.error("Error in streaming:", error);
            controller.enqueue(`data: ${JSON.stringify({ 
              type: "error", 
              error: "Failed to analyze dictation" 
            })}\n\n`);
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
