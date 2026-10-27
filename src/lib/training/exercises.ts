import type {
  ChoicePayload,
  ClassifyPayload,
  ExerciseGen,
  ExercisePayload,
  FillBlanksPayload,
  GradedUnit,
  ItemResult,
  LabelPayload,
  MarkWordsPayload,
  OpenPayload,
  Token,
} from "./schema";

// ---------------------------------------------------------------------------
// Tokenizer (mark_words)
// ---------------------------------------------------------------------------

// A word is a run of letters/digits, keeping a trailing apostrophe so that
// "l'école" becomes ["l'", "école"]. Everything else is a punctuation token.
const TOKEN_RE = /(\s*)([\p{L}\p{N}]+['’]?|[^\s\p{L}\p{N}])/gu;

// Elided words that are a single word in French and must not be split.
const JOINED_ELISIONS = new Set(["aujourd'", "presqu'", "prud'", "quelqu'", "entr'"]);

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    const [, pre, value] = match;
    const isWord = /[\p{L}\p{N}]/u.test(value);
    const prev = tokens[tokens.length - 1];
    if (
      isWord &&
      prev &&
      pre === "" &&
      JOINED_ELISIONS.has(prev.text.toLowerCase().replace("’", "'"))
    ) {
      prev.text += value;
      continue;
    }
    tokens.push({ text: value, pre, word: isWord });
  }
  return tokens;
}

function sameWord(a: string, b: string) {
  return a.toLocaleLowerCase("fr").replace("’", "'") ===
    b.toLocaleLowerCase("fr").replace("’", "'");
}

/** Finds the first token range matching `span` that does not overlap `claimed`. */
function findSpan(tokens: Token[], span: string, claimed: Set<number>) {
  const spanTokens = tokenize(span).filter((t) => t.word);
  if (spanTokens.length === 0) return null;
  for (let start = 0; start < tokens.length; start++) {
    let i = start;
    let j = 0;
    while (i < tokens.length && j < spanTokens.length) {
      if (!tokens[i].word) {
        // Punctuation inside the span (e.g. the hyphen of "sous-marins")
        if (i === start) break;
        i++;
        continue;
      }
      if (!sameWord(tokens[i].text, spanTokens[j].text)) break;
      i++;
      j++;
    }
    if (j === spanTokens.length) {
      const end = i - 1;
      let overlaps = false;
      for (let k = start; k <= end; k++) if (claimed.has(k)) overlaps = true;
      if (!overlaps) return { start, end };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Normalization: LLM output -> stored payload. Drops anything inconsistent
// (bad indexes, unmappable spans...) rather than failing the whole session.
// ---------------------------------------------------------------------------

function clean(s: string) {
  return s.trim();
}

export function normalizeExercise(
  gen: ExerciseGen,
  skillIds: Set<string>
): ExercisePayload | null {
  const skill = (id: string) => (skillIds.has(id) ? id : "general");

  switch (gen.type) {
    case "choice": {
      const questions = gen.questions
        .map((q, i) => {
          const options = q.options.map(clean).filter(Boolean);
          const correct = [...new Set(q.correct_indexes)]
            .filter((c) => c >= 0 && c < options.length)
            .sort((a, b) => a - b);
          if (options.length < 2 || correct.length === 0) return null;
          return {
            id: `q${i + 1}`,
            prompt: clean(q.prompt),
            options,
            correct,
            skill_id: skill(q.skill_id),
            explanation: clean(q.explanation),
          };
        })
        .filter((q) => q !== null);
      if (questions.length === 0) return null;
      return { type: "choice", title: gen.title, instruction: gen.instruction, questions };
    }

    case "fill_blanks": {
      let blankCounter = 0;
      const sentences = gen.sentences
        .map((s, i) => {
          const parts = s.text.split(/_{3,}/);
          const answers = s.blanks.filter((b) => b.answers.some((a) => clean(a)));
          if (parts.length < 2 || parts.length - 1 !== answers.length) return null;
          return {
            id: `s${i + 1}`,
            parts,
            blanks: answers.map((b) => ({
              id: `b${++blankCounter}`,
              answers: b.answers.map(clean).filter(Boolean),
              skill_id: skill(b.skill_id),
              explanation: clean(b.explanation),
            })),
          };
        })
        .filter((s) => s !== null);
      if (sentences.length === 0) return null;
      return {
        type: "fill_blanks",
        title: gen.title,
        instruction: gen.instruction,
        word_bank: gen.word_bank.map(clean).filter(Boolean),
        sentences,
      };
    }

    case "mark_words": {
      const legend = gen.legend.filter((l) => clean(l.key));
      const keys = new Set(legend.map((l) => l.key));
      if (legend.length === 0) return null;
      let targetCounter = 0;
      const sentences = gen.sentences
        .map((s, i) => {
          const tokens = tokenize(s.text);
          const claimed = new Set<number>();
          const targets = s.targets
            .filter((t) => keys.has(t.key))
            .map((t) => {
              const range = findSpan(tokens, t.text, claimed);
              if (!range) return null;
              for (let k = range.start; k <= range.end; k++) claimed.add(k);
              return {
                id: `t${++targetCounter}`,
                key: t.key,
                text: clean(t.text),
                start: range.start,
                end: range.end,
                skill_id: skill(t.skill_id),
                explanation: clean(t.explanation),
              };
            })
            .filter((t) => t !== null);
          if (targets.length === 0) return null;
          return { id: `s${i + 1}`, tokens, targets };
        })
        .filter((s) => s !== null);
      if (sentences.length === 0) return null;
      return {
        type: "mark_words",
        title: gen.title,
        instruction: gen.instruction,
        legend,
        sentences,
      };
    }

    case "rewrite":
    case "short_answer": {
      const items = gen.items
        .map((item, i) => {
          const answers = item.expected_answers.map(clean).filter(Boolean);
          if (!clean(item.prompt) || answers.length === 0) return null;
          return {
            id: `i${i + 1}`,
            prompt: clean(item.prompt),
            answers,
            skill_id: skill(item.skill_id),
            explanation: clean(item.explanation),
          };
        })
        .filter((i) => i !== null);
      if (items.length === 0) return null;
      return { type: gen.type, title: gen.title, instruction: gen.instruction, items };
    }

    case "classify":
    case "label": {
      const options = (gen.type === "classify" ? gen.categories : gen.options).filter(
        (o) => clean(o.key) && clean(o.label)
      );
      const keys = new Set(options.map((o) => o.key));
      const items = gen.items
        .map((item, i) => {
          const expected = gen.type === "classify"
            ? (item as { category_key: string }).category_key
            : (item as { answer_key: string }).answer_key;
          if (!keys.has(expected) || !clean(item.text)) return null;
          return {
            id: `i${i + 1}`,
            text: clean(item.text),
            expected,
            skill_id: skill(item.skill_id),
            explanation: clean(item.explanation),
          };
        })
        .filter((i) => i !== null);
      if (options.length < 2 || items.length === 0) return null;
      if (gen.type === "classify") {
        return {
          type: "classify",
          title: gen.title,
          instruction: gen.instruction,
          categories: options,
          items: items.map(({ expected, ...rest }) => ({ ...rest, category: expected })),
        };
      }
      return {
        type: "label",
        title: gen.title,
        instruction: gen.instruction,
        options,
        items: items.map(({ expected, ...rest }) => ({ ...rest, answer: expected })),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Items: the unit the student validates at once (a question, a sentence...)
// ---------------------------------------------------------------------------

export function itemKeys(payload: ExercisePayload): string[] {
  switch (payload.type) {
    case "choice":
      return payload.questions.map((q) => q.id);
    case "fill_blanks":
    case "mark_words":
      return payload.sentences.map((s) => s.id);
    case "classify":
      return ["all"];
    case "label":
    case "rewrite":
    case "short_answer":
      return payload.items.map((i) => i.id);
  }
}

/** Number of scored units the exercise holds before grading (extras excluded). */
export function unitCount(payload: ExercisePayload): number {
  switch (payload.type) {
    case "choice":
      return payload.questions.length;
    case "fill_blanks":
      return payload.sentences.reduce((n, s) => n + s.blanks.length, 0);
    case "mark_words":
      return payload.sentences.reduce((n, s) => n + s.targets.length, 0);
    case "classify":
    case "label":
    case "rewrite":
    case "short_answer":
      return payload.items.length;
  }
}

export function exerciseSkillIds(payload: ExercisePayload): string[] {
  const ids = new Set<string>();
  switch (payload.type) {
    case "choice":
      payload.questions.forEach((q) => ids.add(q.skill_id));
      break;
    case "fill_blanks":
      payload.sentences.forEach((s) => s.blanks.forEach((b) => ids.add(b.skill_id)));
      break;
    case "mark_words":
      payload.sentences.forEach((s) => s.targets.forEach((t) => ids.add(t.skill_id)));
      break;
    case "classify":
    case "label":
    case "rewrite":
    case "short_answer":
      payload.items.forEach((i) => ids.add(i.skill_id));
      break;
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Public projection: what the student sees before answering (no answer key)
// ---------------------------------------------------------------------------

export type PublicPayload =
  | (Omit<ChoicePayload, "questions"> & {
      questions: { id: string; prompt: string; options: string[]; multiple: boolean }[];
    })
  | (Omit<FillBlanksPayload, "sentences"> & {
      sentences: { id: string; parts: string[]; blanks: { id: string }[] }[];
    })
  | (Omit<MarkWordsPayload, "sentences"> & {
      sentences: { id: string; tokens: Token[] }[];
    })
  | (Omit<ClassifyPayload, "items"> & { items: { id: string; text: string }[] })
  | (Omit<LabelPayload, "items"> & { items: { id: string; text: string }[] })
  | (Omit<OpenPayload, "items"> & { items: { id: string; prompt: string }[] });

export function toPublicPayload(payload: ExercisePayload): PublicPayload {
  switch (payload.type) {
    case "choice":
      return {
        ...payload,
        questions: payload.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          options: q.options,
          multiple: q.correct.length > 1,
        })),
      };
    case "fill_blanks":
      return {
        ...payload,
        sentences: payload.sentences.map((s) => ({
          id: s.id,
          parts: s.parts,
          blanks: s.blanks.map((b) => ({ id: b.id })),
        })),
      };
    case "mark_words":
      return {
        ...payload,
        sentences: payload.sentences.map((s) => ({ id: s.id, tokens: s.tokens })),
      };
    case "classify":
    case "label":
      return {
        ...payload,
        items: payload.items.map((i) => ({ id: i.id, text: i.text })),
      } as PublicPayload;
    case "rewrite":
    case "short_answer":
      return {
        ...payload,
        items: payload.items.map((i) => ({ id: i.id, prompt: i.prompt })),
      };
  }
}

// ---------------------------------------------------------------------------
// Deterministic grading
// ---------------------------------------------------------------------------

/** Lenient comparison for typed answers: case, spaces, apostrophes, final dot. */
export function normalizeAnswer(s: string) {
  return s
    .normalize("NFC")
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\s*'\s*/g, "'")
    .trim()
    .replace(/[.!?;,]+$/, "")
    .toLocaleLowerCase("fr");
}

export class GradingError extends Error {}

export function gradeItem(
  payload: ExercisePayload,
  itemKey: string,
  answer: unknown
): ItemResult {
  switch (payload.type) {
    case "choice": {
      const q = payload.questions.find((q) => q.id === itemKey);
      if (!q) throw new GradingError("Question inconnue");
      const selected = Array.isArray(answer)
        ? [...new Set(answer.filter((n): n is number => Number.isInteger(n)))].sort((a, b) => a - b)
        : [];
      if (selected.length === 0) throw new GradingError("Choisis au moins une réponse");
      const is_correct =
        selected.length === q.correct.length && selected.every((v, i) => v === q.correct[i]);
      return {
        kind: "choice",
        selected,
        correct: q.correct,
        is_correct,
        explanation: q.explanation,
        units: [{ skill_id: q.skill_id, correct: is_correct }],
      };
    }

    case "fill_blanks": {
      const s = payload.sentences.find((s) => s.id === itemKey);
      if (!s) throw new GradingError("Phrase inconnue");
      const given = Array.isArray(answer) ? answer.map((a) => String(a ?? "")) : [];
      const blanks = s.blanks.map((b, i) => {
        const value = given[i] ?? "";
        const correct = b.answers.some((a) => normalizeAnswer(a) === normalizeAnswer(value));
        return { id: b.id, given: value.trim(), expected: b.answers[0], correct, explanation: b.explanation };
      });
      return {
        kind: "fill_blanks",
        blanks,
        units: blanks.map((b, i) => ({ skill_id: s.blanks[i].skill_id, correct: b.correct })),
      };
    }

    case "mark_words": {
      const s = payload.sentences.find((s) => s.id === itemKey);
      if (!s) throw new GradingError("Phrase inconnue");
      const marks = new Map<number, string>();
      if (Array.isArray(answer)) {
        for (const m of answer as { i?: unknown; key?: unknown }[]) {
          const i = Number(m?.i);
          if (Number.isInteger(i) && s.tokens[i]?.word && typeof m.key === "string") {
            marks.set(i, m.key);
          }
        }
      }
      const targets = s.targets.map((t) => {
        let correct = true;
        for (let k = t.start; k <= t.end; k++) {
          if (s.tokens[k].word && marks.get(k) !== t.key) correct = false;
        }
        return { id: t.id, key: t.key, text: t.text, start: t.start, end: t.end, correct, explanation: t.explanation };
      });
      const extras = [...marks.entries()]
        .filter(([i, key]) => !s.targets.some((t) => t.key === key && i >= t.start && i <= t.end))
        .map(([i]) => i)
        .sort((a, b) => a - b);
      // Each contiguous group of wrongly marked words counts as one mistake
      const extraGroups = extras.filter((i, idx) => {
        if (idx === 0) return true;
        for (let k = extras[idx - 1] + 1; k < i; k++) if (s.tokens[k].word) return true;
        return false;
      }).length;
      const units: GradedUnit[] = [
        ...s.targets.map((t, i) => ({ skill_id: t.skill_id, correct: targets[i].correct })),
        ...Array.from({ length: extraGroups }, () => ({
          skill_id: s.targets[0].skill_id,
          correct: false,
        })),
      ];
      return { kind: "mark_words", targets, extras, units };
    }

    case "rewrite":
    case "short_answer": {
      // Exact match only; answers that differ are re-checked by the AI
      const item = payload.items.find((i) => i.id === itemKey);
      if (!item) throw new GradingError("Question inconnue");
      const given = typeof answer === "string" ? answer.trim() : "";
      if (!given) throw new GradingError("Écris ta réponse");
      const correct = item.answers.some((a) => normalizeAnswer(a) === normalizeAnswer(given));
      return {
        kind: "open",
        given,
        expected: item.answers[0],
        correct,
        explanation: item.explanation,
        feedback: null,
        units: [{ skill_id: item.skill_id, correct }],
      };
    }

    case "classify":
    case "label": {
      const isClassify = payload.type === "classify";
      const entries = isClassify
        ? (payload as ClassifyPayload).items.map((i) => ({ ...i, expected: i.category }))
        : (payload as LabelPayload).items
            .filter((i) => i.id === itemKey)
            .map((i) => ({ ...i, expected: i.answer }));
      if (entries.length === 0 || (isClassify && itemKey !== "all")) {
        throw new GradingError("Élément inconnu");
      }
      const given = new Map<string, string>();
      if (isClassify && Array.isArray(answer)) {
        for (const a of answer as { id?: unknown; key?: unknown }[]) {
          if (typeof a?.id === "string" && typeof a.key === "string") given.set(a.id, a.key);
        }
      } else if (!isClassify && typeof answer === "string") {
        given.set(itemKey, answer);
      }
      if (!isClassify && given.size === 0) throw new GradingError("Choisis une réponse");
      const items = entries.map((e) => {
        const value = given.get(e.id) ?? null;
        return { id: e.id, given: value, expected: e.expected, correct: value === e.expected, explanation: e.explanation };
      });
      return {
        kind: payload.type,
        items,
        units: items.map((item, i) => ({ skill_id: entries[i].skill_id, correct: item.correct })),
      };
    }
  }
}

/** Plain-text lines of an exercise, used to avoid repeating sentences across sessions. */
export function exerciseTexts(payload: ExercisePayload): string[] {
  switch (payload.type) {
    case "choice":
      return payload.questions.map((q) => q.prompt);
    case "fill_blanks":
      return payload.sentences.map((s) => s.parts.join("___"));
    case "mark_words":
      return payload.sentences.map((s) => s.tokens.map((t) => t.pre + t.text).join(""));
    case "classify":
    case "label":
      return payload.items.map((i) => i.text);
    case "rewrite":
    case "short_answer":
      return payload.items.map((i) => i.prompt);
  }
}
