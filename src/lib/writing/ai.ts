import { AI_MODEL_FAST, AI_MODEL_SMART } from "@/lib/ai-models";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { ChatMessage, CorrectionGen, CorrectionSchema, OutlineGen, OutlineSchema } from "./schema";

const client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

export interface StudentContext {
  firstName: string;
  age: number | null;
  levelLabel: string | null;
  description: string | null;
  books: string[];
  movies: string | null;
  news: string | null;
  /** Titles of the student's other expressions écrites */
  previousTopics: string[];
}

function describeStudent(s: StudentContext) {
  return [
    `Prénom : ${s.firstName}`,
    s.age ? `Âge : ${s.age} ans` : null,
    s.levelLabel ? `Niveau scolaire : ${s.levelLabel}` : null,
    s.description ? `Ce que ses parents disent de lui/elle : ${s.description}` : null,
    s.books.length ? `Livres lus ou en cours : ${s.books.join(" ; ")}` : null,
    s.movies ? `Films et séries aimés : ${s.movies}` : null,
    s.news ? `Sujets d'actualité qui l'intéressent : ${s.news}` : null,
    s.previousTopics.length
      ? `Sujets de ses expressions écrites précédentes (ne pas les reproposer tels quels) : ${s.previousTopics.join(" ; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const COACH_VOICE = `Tu es le professeur de français de l'élève, bienveillant et enthousiaste. Tu tutoies l'élève et tu écris en français simple, adapté à son âge.`;

// The effort asked of the student is the writing, not inventing the story:
// the coach proposes, the student picks, adjusts or validates.
const OUTLINE_RULES = `${COACH_VOICE}

Ton rôle est d'amener l'élève très vite à une trame d'histoire complète. L'effort qu'on attend de lui, c'est d'écrire le texte, pas d'inventer l'histoire : c'est toi qui proposes une histoire, l'élève la choisit, la modifie s'il veut, et la valide.
- Sois proactif : chacune de tes réponses contient une proposition concrète d'histoire ou de trame. Ne réponds jamais seulement par des questions, et ne demande jamais à l'élève d'inventer un élément (un personnage, un lieu, un problème, une fin…) : invente-le toi-même.
- Si l'élève choisit une de tes idées de sujet, ou donne un sujet vague (par exemple un thème donné en classe), propose 3 histoires différentes, en 2 lignes maximum chacune : un héros, un lieu, un problème, une fin. Demande-lui laquelle il préfère.
- Si l'élève donne sa propre idée d'histoire, même en quelques mots, ne lui pose aucune question : écris tout de suite la trame complète d'une histoire qui garde son idée, en inventant tout ce qui manque.
- La trame complète se présente en un petit paragraphe de 3 à 5 phrases adressé à l'élève, sans liste ni rubriques : « Tu vas raconter l'histoire de… » (le héros, le lieu, ce qui arrive, le rebondissement, la fin). Après, demande seulement s'il veut changer quelque chose ; s'il demande un changement, fais-le toi-même et représente la trame modifiée.
- Pas de compliments à rallonge : quelques mots au plus (« Bonne idée ! ») avant ta proposition.
- La seule question permise se répond en un mot : un numéro, oui ou non, ou un choix entre deux propositions.
- S'il répond « je ne sais pas », hésite ou te demande de choisir, choisis pour lui et avance.
- Vise une trame prête en 1 ou 2 échanges. Quand elle est complète (personnages, lieu, début, problème, fin), dis-le et invite-le à cliquer sur « Valider la trame ».
- La trame reste des idées : n'écris jamais le texte ni des phrases toutes faites qu'il pourrait recopier.
- Réponses courtes. Les listes numérotées (« 1. … ») sont réservées aux choix à faire, une proposition par ligne et sans sous-liste : l'élève clique sur un numéro pour choisir. Pas de titre markdown ; tu peux mettre des mots en **gras**.
- Tes réponses sont lues à voix haute : évite les emojis et les symboles.`;

/** Streams the coach's next message about the outline (plain text). */
export function streamOutlineChat(input: {
  student: StudentContext;
  messages: ChatMessage[];
  currentOutline: string | null;
  minWords: number;
}): { stream: ReadableStream<Uint8Array>; done: Promise<string> } {
  const opening =
    input.messages.length === 0
      ? `\n\nC'est le début de la discussion. Salue l'élève par son prénom en une phrase, explique en une phrase qu'on va construire ensemble la trame d'un texte d'environ ${input.minWords} mots, puis propose exactement 5 idées de sujets numérotées, courtes (une ligne chacune), variées et personnelles : en t'appuyant d'abord sur ses livres, ses films ou ses sujets d'actualité quand tu les connais (par exemple : imaginer une nouvelle aventure d'un personnage, raconter un passage marquant vu par un autre personnage, inventer la suite, écrire sur un sujet d'actualité qui l'intéresse), sinon sur ce que tu sais de lui/elle. Termine en lui demandant de choisir un numéro, ou de te dire son propre sujet s'il en a un (par exemple celui donné en classe).`
      : "";
  const editing = input.currentOutline
    ? `\n\nL'élève revient pour modifier sa trame déjà validée. La voici :\n${input.currentOutline}\nPropose-lui 2 ou 3 changements possibles et fais évoluer la trame comme il le souhaite, puis invite-le à la valider à nouveau.`
    : "";

  const instructions = `${OUTLINE_RULES}

Ce que tu sais de l'élève :
${describeStudent(input.student)}

Objectif : environ ${input.minWords} mots.${opening}${editing}`;

  const encoder = new TextEncoder();
  let resolveDone: (text: string) => void;
  const done = new Promise<string>((r) => (resolveDone = r));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      // The student may leave the page: keep going so the answer is still saved
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {}
      };
      try {
        const response = client.responses.stream({
          model: AI_MODEL_FAST,
          input: [
            { role: "system", content: instructions },
            ...(input.messages.length
              ? input.messages.map((m) => ({ role: m.role, content: m.content }))
              : [{ role: "user" as const, content: "Bonjour !" }]),
          ],
        });
        response.on("response.output_text.delta", (event) => {
          text += event.delta;
          send(event.delta);
        });
        await response.finalResponse();
      } catch (error) {
        console.error("Error streaming outline chat:", error);
        const oops = "\n\nOups, je n'arrive pas à répondre pour l'instant. Réessaie dans un instant.";
        send(oops);
        text = "";
      } finally {
        try {
          controller.close();
        } catch {}
        resolveDone(text);
      }
    },
  });
  return { stream, done };
}

/** Turns the conversation into the outline the student will write from. */
export async function synthesizeOutline(input: {
  student: StudentContext;
  messages: ChatMessage[];
}): Promise<OutlineGen> {
  const conversation = input.messages
    .map((m) => `${m.role === "user" ? input.student.firstName : "Professeur"} : ${m.content}`)
    .join("\n\n");

  const response = await client.responses.parse({
    model: AI_MODEL_FAST,
    input: [
      {
        role: "system",
        content: `Tu rédiges la trame d'une expression écrite à partir d'une discussion entre un élève (${input.student.firstName}${input.student.levelLabel ? `, ${input.student.levelLabel}` : ""}) et son professeur.

Règles :
- Pars des idées retenues : celles que l'élève a choisies ou acceptées parmi les propositions du professeur (un numéro, « oui », « d'accord »…) et les siennes. Laisse de côté les pistes écartées.
- Si un élément manque encore (prénom, lieu, rebondissement, fin…), complète-le toi-même, simplement et en restant fidèle à l'histoire choisie : la trame doit être complète pour que l'élève puisse écrire sans chercher d'idées.
- La trame est un petit texte qui s'adresse à l'élève (tutoiement, au présent), 120 mots au plus, sans sections ni titres :
  1. Un court paragraphe qui résume l'histoire à raconter : « Tu vas raconter l'histoire de… » (qui, où, ce qui arrive, comment ça finit).
  2. Une ou deux phrases pour démarrer : par quoi commencer son texte (« Commence par présenter… »).
  3. « **Idées à raconter :** » suivi de 3 ou 4 suggestions courtes avec des tirets (- …) : des actions, des détails à décrire, une émotion, un dialogue possible.
  Sépare ces trois parties par une ligne vide.
- Ce sont des instructions, jamais l'histoire elle-même : pas de phrases du récit que l'élève pourrait recopier.
- La trame sera lue à voix haute : pas d'emojis.`,
      },
      { role: "user", content: conversation },
    ],
    text: { format: zodTextFormat(OutlineSchema, "outline") },
  });
  if (!response.output_parsed) throw new Error("Trame IA vide");
  const { title, outline } = response.output_parsed;
  // A single line break is not a new paragraph in markdown (list items excepted)
  return { title, outline: outline.replace(/\n(?!\n|\s*- )/g, "\n\n").replace(/\n{3,}/g, "\n\n") };
}

/** Spoken nudge while writing: never a sentence to copy. */
export async function writingHint(input: {
  student: StudentContext;
  outline: string;
  draft: string;
  minWords: number;
  wordCount: number;
}): Promise<string> {
  const response = await client.responses.create({
    model: AI_MODEL_FAST,
    input: [
      {
        role: "system",
        content: `${COACH_VOICE}

L'élève est en train de rédiger son expression écrite et demande un coup de pouce. Ta réponse sera UNIQUEMENT écoutée (jamais affichée).
- Regarde où il en est par rapport à sa trame et dis-lui ce qui pourrait venir ensuite, sous forme de questions qui le font réfléchir (Que ressent ton personnage ? Que voit-il ? Que se passe-t-il ensuite d'après ta trame ?).
- Tu peux suggérer d'ajouter une description, un dialogue, une émotion, un rebondissement, ou de varier les mots de liaison (soudain, ensuite, pourtant…).
- Ne dicte JAMAIS de phrase complète à écrire et ne corrige pas les fautes.
- 3 ou 4 phrases maximum, sans liste ni markdown, sans emojis.

Ce que tu sais de l'élève :
${describeStudent(input.student)}`,
      },
      {
        role: "user",
        content: `Ma trame :\n${input.outline}\n\nCe que j'ai déjà écrit (${input.wordCount} mots sur ${input.minWords}) :\n${input.draft || "(rien encore)"}\n\nJe suis bloqué, aide-moi.`,
      },
    ],
  });
  return response.output_text.trim();
}

/** Corrects one attempt, judged against the student's level. */
export async function correctWriting(input: {
  student: StudentContext;
  outline: string;
  text: string;
  wordCount: number;
  minWords: number;
  previousScores: number[];
}): Promise<{ correction: CorrectionGen; model: string }> {
  const response = await client.responses.parse({
    model: AI_MODEL_SMART,
    reasoning: { effort: "medium" },
    input: [
      {
        role: "system",
        content: `Tu es un professeur des écoles bienveillant et exigeant qui corrige l'expression écrite d'un élève. Tu tutoies l'élève et tu écris en français simple, adapté à son âge.

Élève :
${describeStudent(input.student)}

Juge le travail au regard de son âge et de son niveau : un texte simple mais correct et vivant mérite une bonne note ; ne pénalise pas l'absence de tournures qu'on n'attend pas à ce niveau.

À produire :
1. **errors** : TOUTES les erreurs d'orthographe, de grammaire (accords, ponctuation majeure, majuscules), de conjugaison et de vocabulaire (mot impropre, répétition gênante). Une entrée par erreur, dans l'ordre du texte. \`wrong\` est recopié EXACTEMENT comme dans la copie (mêmes fautes, mêmes espaces), le plus court possible ; \`context_before\` permet de le retrouver. L'explication donne la règle et une astuce pour ne plus se tromper. Ne signale pas les choix de style.
2. **scores** sur 100 : orthographe (spelling), grammaire (grammar, ponctuation comprise), conjugaison (conjugation), vocabulaire (vocabulary : richesse et justesse des mots). Le score global tient compte de ces quatre notes ET de la qualité du récit (respect de la trame, cohérence, créativité). Sois cohérent avec le nombre et la gravité des erreurs rapportés à la longueur du texte.${input.previousScores.length ? ` Scores globaux des essais précédents sur ce sujet : ${input.previousScores.join(", ")}.` : ""}
3. **corrected_text** : la copie avec seulement les fautes corrigées (ne change rien d'autre).
4. **improved_text** : la même histoire réécrite un cran au-dessus du niveau de l'élève : vocabulaire plus précis et plus riche, phrases plus variées et un peu plus complexes, mots de liaison, sans changer ses idées ni la longueur de plus de 30 %. Ce texte servira de modèle et de dictée.
5. **improvements** : 3 à 6 exemples d'enrichissements tirés de improved_text, expliqués.
6. **strengths** (2 à 4), **weaknesses** (1 à 3), **to_work** (1 à 3 notions précises sur lesquelles s'entraîner, d'après les erreurs les plus fréquentes ou importantes).
7. **outline_feedback** : respect de la trame, organisation, créativité.
8. **greeting** : félicite l'effort et donne envie de recommencer.`,
      },
      {
        role: "user",
        content: `Trame décidée avec l'élève :\n${input.outline}\n\nCopie de l'élève (${input.wordCount} mots, objectif ${input.minWords}) :\n${input.text}`,
      },
    ],
    text: { format: zodTextFormat(CorrectionSchema, "writing_correction") },
  });
  if (!response.output_parsed) throw new Error("Correction IA vide");
  return { correction: response.output_parsed, model: AI_MODEL_SMART };
}
