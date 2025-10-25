import { auth } from "@/lib/auth";
import { DicteeAnalysisSchema } from "@/lib/dictation-schema";
import { prisma } from "@/lib/prisma";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import * as fs from "fs";
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import * as path from "path";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

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

    const response = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dictee_analysis",
          schema: {
            type: "object",
            properties: {
              stats: {
                type: "object",
                properties: {
                  total_fautes: { type: "integer", description: "Nombre total de fautes. Si des mots ont été oubliés, ils comptent comme des fautes d'orthographe. Exemple : Si sur une dictée de 10 mots, on a 6 mots bien orthographiés, 3 erreurs, 1 mot oublié, le nombre d'erreurs est de 4." },
                  fautes_orthographe: { type: "integer" , description: "Nombre de fautes d'orthographe"},
                  fautes_grammaire: { type: "integer" , description: "Nombre de fautes de grammaire"},
                  fautes_conjugaison: { type: "integer" , description: "Nombre de fautes de conjugaison"},
                  pourcentage_reussite: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                    description: "Pourcentage de mots bien écrits (0-100) : (1 - Nombre total de fautes / Nombre de mots de la dictée donnée à l'élève) * 100"
                  }
                },
                required: [
                  "total_fautes",
                  "fautes_orthographe",
                  "fautes_grammaire",
                  "fautes_conjugaison",
                  "pourcentage_reussite"
                ],
                additionalProperties: false
              },
              message_general: { type: "string",description: "Message général d'évaluation de la dictée qui donne l'appréciation globale de la dictée. Si le score est bon, féliciter l'élève. Si le score est mauvais, dire que c'est mauvais, mais garder un ton positif et motivant." },
              fautes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    sentence_order_number: { type: "integer", description: "Position de la phrase dans la dictée (commence à 1)." },
                    texte_eleve: { type: "string", description: "Phrase soumise par l'élève. Chaque mot ou expression contenant une erreur dans la phrase doit être en bold (**erreur** dans la phrase.)" },
                    correction: { type: "string", description: "Phrase corrigée sans erreur. Chaque mot ou expression corrigée dans la phrase doit être en italic (*italic* dans la phrase.)" },
                    explication: { type: "string", description: "Explique pourquoi c'est une erreur. Quand tu fais référence à un mot ou expression avec erreur, formatte le en **bold**. Quand tu fais référence à un mot ou expression corrigée, formatte le en *italic*.  Si tu as plusieurs explication, formatte en liste à puce ou numérotée." },
                    regle: { type: "string", description: "Règle expliquée clairement avec des exemples pour que l'élève comprenne, apprenne et ne refasse pas la même erreur. Utilise bold (**bold**) pour la règle, n'utilise pas de formattage pour l'explication et détails de la règle, utilise l'italique (*italic*) pour les exemples. Si tu as plusieurs explication, formatte en liste à puce ou numérotée." }
                  },
                  required: ["sentence_order_number", "texte_eleve", "correction", "explication", "regle"],
                  additionalProperties: false
                }
              },
              conclusion_positive: { type: "string", description: "Conclusion positive et motivante pour motiver l'élève à continuer à progresser en se basant sur son profil et ses résultats." }
            },
            required: ["stats", "message_general", "fautes", "conclusion_positive"],
            additionalProperties: false
          }
        }
      },
    });

    const analysisResult = response.choices[0]?.message?.content;
    
    if (!analysisResult) {
      throw new Error("No response from OpenAI");
    }

    // Parse the JSON response
    const parsedResult = JSON.parse(analysisResult);
    
    // Validate with Zod schema
    let validatedResult;
    try {
      validatedResult = DicteeAnalysisSchema.parse(parsedResult);
    } catch (error) {
      console.error("Zod validation error:", error);
      
      // Try to fix missing fields - ensure all required fields are present
      const fixedResult = {
        stats: parsedResult.stats || parsedResult.bilan_global || {
          total_fautes: 0,
          fautes_orthographe: 0,
          fautes_grammaire: 0,
          fautes_conjugaison: 0,
          pourcentage_reussite: 100
        },
        message_general: parsedResult.message_general || "Analyse terminée",
        fautes: (parsedResult.fautes || []).map((faute: Record<string, unknown>, index: number) => ({
          sentence_order_number: faute.sentence_order_number || index + 1,
          texte_eleve: faute.texte_eleve || faute.texte_noa || "Texte non disponible",
          correction: faute.correction || "Correction non disponible",
          explication: faute.explication || "Je n'ai pas d'explication à te fournir",
          regle: faute.regle || "Il n'y a pas de règle spécifique"
        })),
        conclusion_positive: parsedResult.conclusion_positive || "Continue tes efforts, tu progresses bien !"
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

    // Create output directory and save file (ignore errors in serverless envs)
    let filepath: string | undefined = undefined;
    try {
      const isServerless = !!process.env["VERCEL"]; // Vercel sets VERCEL=true
      const baseDir = isServerless ? "/tmp" : process.cwd();
      const outputDir = path.join(baseDir, "openai_output");
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `dictation_analysis_${dictationId}_${timestamp}.json`;
      filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(validatedResult, null, 2));
      console.log("OpenAI Analysis Result:", validatedResult);
      console.log(`Result saved to: ${filepath}`);
    } catch (fileError) {
      console.warn("Could not persist OpenAI analysis result to filesystem:", fileError);
    }

    // Save the analysis results to the database
    let exerciceAttempt;
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

      console.log("Exercise attempt saved to database:", exerciceAttempt.id);
      
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

    return NextResponse.json({
      success: true,
      analysis: validatedResult,
      filepath: filepath,
      attempt: exerciceAttempt,
    });

  } catch (error) {
    console.error("Error in dictation validation:", error);
    return NextResponse.json(
      { error: "Failed to analyze dictation" },
      { status: 500 }
    );
  }
}
