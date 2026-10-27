import { AI_MODEL_FAST, AI_MODEL_SMART } from "@/lib/ai-models";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent } from "openai/resources/responses/responses";
import {
  ExerciseHint,
  Lesson,
  SessionGen,
  SessionGenSchema,
  SessionReportGen,
  SessionReportGenSchema,
  Skill,
  SkillsResult,
  SourceAnalysis,
  SourceAnalysisSchema,
} from "./schema";

const client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

const TUTOR_PERSONA = `Tu es un professeur des écoles bienveillant et rigoureux qui prépare des exercices de français (grammaire, orthographe, conjugaison, vocabulaire) pour un élève de primaire. Tu écris en français correct, simple et chaleureux, adapté à l'âge de l'élève. Tu tutoies l'élève.`;

// ---------------------------------------------------------------------------
// 1. Read a workbook photo / text instructions -> lesson, skills, category
// ---------------------------------------------------------------------------

export interface TaxonomyEntry {
  id: number;
  name: string;
  topics: { id: number; name: string }[];
}

export async function analyzeSource(input: {
  images: { mime: string; base64: string }[];
  text: string | null;
  taxonomy: TaxonomyEntry[];
  levelLabel: string | null;
}): Promise<SourceAnalysis> {
  const taxonomyText = input.taxonomy
    .map(
      (c) =>
        `- Catégorie #${c.id} « ${c.name} » : ${
          c.topics.map((t) => `thème #${t.id} « ${t.name} »`).join(", ") || "(aucun thème)"
        }`
    )
    .join("\n");

  const instructions = `${TUTOR_PERSONA}

On te donne ${input.images.length > 0 ? "une ou plusieurs photos d'un cahier d'exercices" : "un thème et des consignes"}. Prépare une fiche d'entraînement :

1. **title** : un titre court pour la fiche (ex. « L'article défini et l'article indéfini »).
2. **category** / **topic** : rattache la fiche à la classification existante ci-dessous. Utilise \`existing_id\` si une catégorie ou un thème correspond vraiment (même notion grammaticale), sinon mets \`existing_id: null\` et propose \`new_name\`. Si la catégorie existe mais pas le thème, donne l'id de la catégorie et un nouveau nom de thème. Les thèmes sont des notions précises (« Le groupe nominal »), les catégories des domaines (« Grammaire », « Orthographe », « Conjugaison », « Vocabulaire »).
3. **lesson** : reformule la leçon à retenir.
   - \`je_retiens\` : les règles et définitions (sections avec un titre, des points courts, des exemples).
   - \`je_sais_faire\` : les méthodes et astuces pour réussir les exercices.
   Si la source ne contient pas de leçon, écris-la toi-même à partir du thème. Utilise **gras** pour les mots-clés. Reformule avec tes mots : ne recopie pas le cahier mot pour mot.
4. **skills** : découpe la notion en 3 à 6 compétences observables et testables séparément. \`id\` en snake_case court (ex. \`contraction_article\`), \`label\` lisible par un enfant (ex. « Contracter à + le → au »), \`description\` d'une phrase.
5. **exercise_hints** : les types d'exercices présents dans la source (ou adaptés au thème), parmi : choice (QCM), fill_blanks (texte à trous), mark_words (souligner/entourer des mots dans une phrase), classify (classer des mots dans des colonnes), label (étiqueter chaque élément : MS/FP, NP/GN…), other. Décris chaque consigne en une phrase.

Classification existante :
${taxonomyText || "(vide)"}
${input.levelLabel ? `\nNiveau de l'élève : ${input.levelLabel}.` : ""}`;

  const content: ResponseInputContent[] = [
    {
      type: "input_text",
      text: input.text?.trim()
        ? `Thème et consignes donnés par le parent :\n${input.text.trim()}`
        : "Analyse la ou les photos jointes.",
    },
    ...input.images.map(
      (img): ResponseInputContent => ({
        type: "input_image",
        image_url: `data:${img.mime};base64,${img.base64}`,
        detail: "high",
      })
    ),
  ];

  const response = await client.responses.parse({
    model: AI_MODEL_SMART,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: instructions },
      { role: "user", content },
    ],
    text: { format: zodTextFormat(SourceAnalysisSchema, "source_analysis") },
  });

  if (!response.output_parsed) throw new Error("Analyse IA vide");
  return response.output_parsed;
}

// ---------------------------------------------------------------------------
// 2. Generate the exercises of a new session
// ---------------------------------------------------------------------------

export interface SessionContext {
  title: string;
  categoryName: string;
  topicName: string;
  lesson: Lesson;
  skills: Skill[];
  hints: ExerciseHint[];
  sourceText: string | null;
  student: { firstName: string; age: number | null; levelLabel: string | null };
  /** Aggregated mastery over previous sessions, by skill id */
  mastery: SkillsResult;
  previousAdvice: string[];
  usedSentences: string[];
  exerciseCount: number;
}

const EXERCISE_FORMATS = `Formats disponibles (champ \`type\`) :
- **choice** — QCM. 4 à 6 \`questions\`, chacune avec 2 à 4 \`options\` et les \`correct_indexes\` (index à partir de 0 ; plusieurs index seulement si la question demande explicitement plusieurs réponses).
- **fill_blanks** — texte à trous. 4 à 6 \`sentences\` ; chaque trou est écrit \`___\` (3 tirets bas) dans \`text\`, et \`blanks\` liste dans l'ordre les réponses acceptées pour chaque trou (toutes les variantes correctes). \`word_bank\` : les mots proposés (ex. ["au","aux","du","des"]) ou [] si saisie libre.
- **mark_words** — souligner/entourer des mots. 3 à 4 \`sentences\`. \`legend\` : 1 à 3 couleurs avec une \`key\` (ex. "verbe") et un \`label\` (ex. "Verbe en rouge"). \`targets\` : chaque mot ou groupe de mots à marquer, recopié EXACTEMENT comme dans la phrase (même orthographe), avec sa \`key\`. Un mot ne peut appartenir qu'à une seule cible. Ne mets pas de mot à marquer en double dans une même phrase.
- **classify** — classer en colonnes. 2 à 4 \`categories\` (key + label) et 8 à 12 \`items\` (mots ou groupes de mots) avec leur \`category_key\`.
- **label** — étiqueter chaque élément. 2 à 5 \`options\` (ex. MS, MP, FS, FP avec label « masculin singulier »…) et 5 à 8 \`items\` avec leur \`answer_key\`.

Pour chaque élément, \`skill_id\` est l'id de la compétence travaillée et \`explanation\` explique en 1 ou 2 phrases courtes POURQUOI la bonne réponse est juste (elle sera montrée à l'élève qu'il ait juste ou faux ; pas de « Bravo » ni de « Tu t'es trompé »). Tu peux utiliser du **gras**.`;

export async function generateSession(ctx: SessionContext): Promise<{ gen: SessionGen; model: string }> {
  const skillLines = ctx.skills
    .map((s) => {
      const m = ctx.mastery[s.id];
      const level = m && m.total > 0 ? ` — réussite passée : ${Math.round((m.correct / m.total) * 100)} % sur ${m.total} questions` : " — jamais travaillée";
      return `- \`${s.id}\` : ${s.label} (${s.description})${level}`;
    })
    .join("\n");

  const instructions = `${TUTOR_PERSONA}

Tu prépares une nouvelle session d'entraînement de ${ctx.exerciseCount} exercices sur « ${ctx.title} » (${ctx.categoryName} › ${ctx.topicName}).

Élève : ${ctx.student.firstName}${ctx.student.age ? `, ${ctx.student.age} ans` : ""}${ctx.student.levelLabel ? `, niveau ${ctx.student.levelLabel}` : ""}.

Compétences de la fiche :
${skillLines}

Règles :
- Commence plus facile puis augmente progressivement la difficulté.
- Varie les formats : au moins 3 formats différents, en t'inspirant des consignes du cahier ci-dessous.
- Insiste sur les compétences les plus faibles (ou jamais travaillées) ; revois brièvement les compétences acquises.
- Invente des phrases NOUVELLES, concrètes et variées (vie quotidienne, nature, école, animaux, voyages…), au vocabulaire adapté à l'âge. Ne recopie jamais les phrases du cahier ni celles des sessions précédentes.
- Chaque exercice a un \`title\` court et une \`instruction\` claire à l'impératif, comme dans un cahier (ex. « Souligne les verbes en rouge et les sujets en vert. »).
- Vérifie chaque réponse attendue : elle doit être indiscutablement correcte en français.
- \`intro_message\` : 1 à 2 phrases d'accueil pour l'élève, qui annoncent ce qu'on va travailler (mentionne ce qui était à revoir la dernière fois s'il y en a).
- \`focus_skill_ids\` : les compétences sur lesquelles tu insistes.

${EXERCISE_FORMATS}

Leçon de la fiche :
${JSON.stringify(ctx.lesson)}

Consignes du cahier :
${ctx.hints.map((h) => `- [${h.type}] ${h.description}`).join("\n") || "(aucune)"}
${ctx.sourceText ? `\nConsignes du parent :\n${ctx.sourceText}` : ""}
${ctx.previousAdvice.length ? `\nBilan des sessions précédentes :\n${ctx.previousAdvice.map((a) => `- ${a}`).join("\n")}` : ""}
${ctx.usedSentences.length ? `\nPhrases et mots déjà utilisés (à NE PAS réutiliser) :\n${ctx.usedSentences.slice(0, 150).map((s) => `- ${s}`).join("\n")}` : ""}`;

  const response = await client.responses.parse({
    model: AI_MODEL_SMART,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: instructions },
      { role: "user", content: `Génère les ${ctx.exerciseCount} exercices de la session.` },
    ],
    text: { format: zodTextFormat(SessionGenSchema, "training_session") },
  });

  if (!response.output_parsed) throw new Error("Génération IA vide");
  return { gen: response.output_parsed, model: AI_MODEL_SMART };
}

// ---------------------------------------------------------------------------
// 3. End-of-session report
// ---------------------------------------------------------------------------

export async function generateReport(input: {
  firstName: string;
  title: string;
  score20: number;
  skills: { label: string; correct: number; total: number }[];
  mistakes: string[];
}): Promise<SessionReportGen> {
  const instructions = `${TUTOR_PERSONA}

L'élève ${input.firstName} vient de terminer une session sur « ${input.title} » avec la note de ${input.score20}/20. Rédige son bilan à partir des résultats ci-dessous (déjà calculés, ne les recalcule pas) :
- \`compris\` : 1 à 4 points courts sur ce qui est acquis (compétences ≥ 80 %). Liste vide si rien n'est acquis.
- \`a_revoir\` : 1 à 4 points courts et concrets sur ce qui est à retravailler (compétences < 80 %), en citant la règle utile. Liste vide si tout est réussi.
- \`message\` : 1 à 2 phrases d'encouragement sincères, adaptées à la note.
- \`conseil\` : 1 phrase sur ce qu'il faut travailler à la prochaine session.

Résultats par compétence :
${input.skills.map((s) => `- ${s.label} : ${s.correct}/${s.total}`).join("\n")}

Erreurs commises :
${input.mistakes.slice(0, 30).map((m) => `- ${m}`).join("\n") || "(aucune)"}`;

  const response = await client.responses.parse({
    model: AI_MODEL_FAST,
    input: [
      { role: "system", content: instructions },
      { role: "user", content: "Rédige le bilan." },
    ],
    text: { format: zodTextFormat(SessionReportGenSchema, "session_report") },
  });

  if (!response.output_parsed) throw new Error("Bilan IA vide");
  return response.output_parsed;
}
