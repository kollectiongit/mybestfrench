import { auth } from "@/lib/auth";
import { DicteeAnalysisSchema } from "@/lib/dictation-schema";
import { getCurrentProfileFromCookie } from "@/lib/profile-cookies";
import * as fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import * as path from "path";
import { PrismaClient } from "../../../../generated/prisma";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
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
      dictationId, 
      studentText, 
      originalText, 
      profileAge, 
      profileFirstName, 
      profileDescription, 
      profileLevels 
    } = body;

    if (!dictationId || !studentText || !originalText || !profileAge) {
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

# Dictée correcte
${originalText}

# Copie de l'élève
${studentText}

# Tâches
1. Donne un **bilan global** :
   - Nombre total de fautes  
   - Répartition : fautes d'orthographe / de grammaire / de conjugaison  
   - % de mots bien orthographiés  

2. Analyse **chaque faute** en regroupant par phrase :
   - a. Ce que ${profileFirstName || 'ton élève'} a écrit  
   - b. La bonne correction  
   - c. Pourquoi c'est une faute  
   - d. La règle expliquée simplement  

3. Termine par une **conclusion encourageante** pour motiver ${profileFirstName || 'ton élève'}.

`;

    const userPrompt = `Analyse cette dictée selon les instructions données et réponds en JSON avec la structure exacte demandée.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o",
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
                  total_fautes: { type: "integer", description: "Ordre de la phrase dans la dictée (commence à 1)" },
                  fautes_orthographe: { type: "integer" , description: "Nombre de fautes d'orthographe"},
                  fautes_grammaire: { type: "integer" , description: "Nombre de fautes de grammaire"},
                  fautes_conjugaison: { type: "integer" , description: "Nombre de fautes de conjugaison"},
                  pourcentage_mots_bien_orthographies: {
                    type: "integer",
                    minimum: 0,
                    maximum: 100,
                    description: "Pourcentage de mots bien écrits (0-100)"
                  }
                },
                required: [
                  "total_fautes",
                  "fautes_orthographe",
                  "fautes_grammaire",
                  "fautes_conjugaison",
                  "pourcentage_mots_bien_orthographies"
                ],
                additionalProperties: false
              },
              message_general: { type: "string",description: "Message général d'évaluation de la dictée qui donne l'appréciation globale de la dictée" },
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
            required: ["sentence_order_number", "stats", "message_general", "fautes", "conclusion_positive"],
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
          pourcentage_mots_bien_orthographies: 100
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
            pourcentage_mots_bien_orthographies: 100
          },
          message_general: "Analyse terminée",
          fautes: [],
          conclusion_positive: "Continue tes efforts, tu progresses bien !"
        };
      }
    }

    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), "public", "openai_output");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save the result to a file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `dictation_analysis_${dictationId}_${timestamp}.json`;
    const filepath = path.join(outputDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(validatedResult, null, 2));

    console.log("OpenAI Analysis Result:", validatedResult);
    console.log(`Result saved to: ${filepath}`);

    // Save the analysis results to the database
    try {
      const exerciceAttempt = await prisma.exercices_attempts.create({
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
          correction_errors_percentage: validatedResult.stats.pourcentage_mots_bien_orthographies,
          correction_greeting_message: validatedResult.message_general,
          correction_errors_by_sentence_json: validatedResult.fautes,
          correction_conclusion_message: validatedResult.conclusion_positive,
          correction_full_json: JSON.stringify(validatedResult),
        },
      });

      console.log("Exercise attempt saved to database:", exerciceAttempt.id);
    } catch (dbError) {
      console.error("Error saving to database:", dbError);
      // Continue with the response even if database save fails
    }

    return NextResponse.json({
      success: true,
      analysis: validatedResult,
      filepath: `/openai_output/${filename}`,
    });

  } catch (error) {
    console.error("Error in dictation validation:", error);
    return NextResponse.json(
      { error: "Failed to analyze dictation" },
      { status: 500 }
    );
  }
}
