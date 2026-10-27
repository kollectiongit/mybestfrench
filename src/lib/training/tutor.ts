import { AI_MODEL_FAST } from "@/lib/ai-models";
import OpenAI from "openai";
import { ExercisePayload, ItemResult, Lesson } from "./schema";

const client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** Plain-text description of one corrected item, for the tutor's context. */
export function describeItem(payload: ExercisePayload, itemKey: string, result: ItemResult): string {
  const mark = (ok: boolean) => (ok ? "juste" : "faux");
  switch (payload.type) {
    case "choice": {
      const q = payload.questions.find((q) => q.id === itemKey);
      if (!q || result.kind !== "choice") break;
      return `Question : ${q.prompt}
Choix : ${q.options.map((o, i) => `${i + 1}. ${o}`).join(" / ")}
Bonne réponse : ${q.correct.map((i) => q.options[i]).join(", ")}
Réponse de l'élève : ${result.selected.map((i) => q.options[i]).join(", ")} (${mark(result.is_correct)})
Explication prévue : ${q.explanation}`;
    }
    case "fill_blanks": {
      const s = payload.sentences.find((s) => s.id === itemKey);
      if (!s || result.kind !== "fill_blanks") break;
      return `Phrase à trous : ${s.parts.join("___")}
${result.blanks.map((b, i) => `Trou ${i + 1} : attendu « ${b.expected} », l'élève a écrit « ${b.given} » (${mark(b.correct)}). ${b.explanation}`).join("\n")}`;
    }
    case "mark_words": {
      const s = payload.sentences.find((s) => s.id === itemKey);
      if (!s || result.kind !== "mark_words") break;
      const sentence = s.tokens.map((t) => t.pre + t.text).join("");
      const legend = Object.fromEntries(payload.legend.map((l) => [l.key, l.label]));
      return `Phrase : ${sentence}
${result.targets.map((t) => `« ${t.text} » = ${legend[t.key] ?? t.key} : ${t.correct ? "trouvé" : "pas trouvé"}. ${t.explanation}`).join("\n")}
${result.extras.length ? `Mots marqués à tort : ${result.extras.map((i) => s.tokens[i]?.text).join(", ")}` : ""}`;
    }
    case "classify":
    case "label": {
      if (result.kind !== "classify" && result.kind !== "label") break;
      const options = payload.type === "classify" ? payload.categories : payload.options;
      const label = (k: string | null) => options.find((o) => o.key === k)?.label ?? k ?? "rien";
      return result.items
        .map((r) => {
          const text = payload.items.find((i) => i.id === r.id)?.text ?? r.id;
          return `« ${text} » : attendu ${label(r.expected)}, l'élève a choisi ${label(r.given)} (${mark(r.correct)}). ${r.explanation}`;
        })
        .join("\n");
    }
    case "rewrite":
    case "short_answer": {
      const item = payload.items.find((i) => i.id === itemKey);
      if (!item || result.kind !== "open") break;
      return `Énoncé : ${item.prompt}
Réponses attendues : ${item.answers.join(" / ")}
Réponse de l'élève : « ${result.given} » (${mark(result.correct)})
Explication prévue : ${item.explanation}${result.feedback ? `\nCommentaire de correction : ${result.feedback}` : ""}`;
    }
  }
  return "";
}

/** Streams the tutor's answer as plain text. */
export function streamTutorAnswer(input: {
  firstName: string;
  levelLabel: string | null;
  lesson: Lesson;
  instruction: string;
  itemContext: string;
  messages: ChatMessage[];
}): ReadableStream<Uint8Array> {
  const instructions = `Tu es le professeur particulier de ${input.firstName}${input.levelLabel ? ` (${input.levelLabel})` : ""}, bienveillant et patient. Tu tutoies l'élève. Il vient de répondre à une question d'un exercice de français et te demande des explications.

Règles :
- Réponds en 2 à 5 phrases courtes, simples, adaptées à un enfant. Pas de liste longue, pas de titre.
- Explique la règle avec un exemple concret, puis une astuce pour ne plus se tromper (ex. remplacer par « il », changer le temps…).
- Appuie-toi sur la leçon ci-dessous ; si l'élève avait juste, confirme et approfondis un peu.
- Reste sur le français et cet exercice. Si l'élève parle d'autre chose, ramène-le gentiment à l'exercice.
- Tu peux utiliser du **gras** pour les mots importants.

Consigne de l'exercice : ${input.instruction}

Question corrigée :
${input.itemContext}

Leçon :
${JSON.stringify(input.lesson)}`;

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const stream = client.responses.stream({
          model: AI_MODEL_FAST,
          input: [
            { role: "system", content: instructions },
            ...input.messages.map((m) => ({ role: m.role, content: m.content })),
          ],
        });
        stream.on("response.output_text.delta", (event) => {
          controller.enqueue(encoder.encode(event.delta));
        });
        await stream.finalResponse();
      } catch (error) {
        console.error("Error streaming tutor answer:", error);
        controller.enqueue(encoder.encode("\n\nOups, je n'arrive pas à répondre pour l'instant. Réessaie dans un instant."));
      } finally {
        controller.close();
      }
    },
  });
}
