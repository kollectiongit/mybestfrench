// Deterministic word-level comparison between a dictation and the student's copy.
// The score, the error count and the highlighting must never depend on the LLM:
// the model only explains the errors computed here.
//
// Rules (same as the ones given to the teacher prompt):
// - punctuation, capital letters and apostrophes are ignored
// - accents, letters, hyphens inside words, missing or extra words are errors

type Token = {
  raw: string;
  norm: string;
  start: number;
  end: number;
};

type Op =
  | { kind: "match"; o: number; s: number }
  | { kind: "sub"; o: number; s: number }
  | { kind: "del"; o: number } // word of the dictation missing in the copy
  | { kind: "ins"; s: number }; // extra word in the copy

export type DictationErrorUnit = {
  id: number;
  // Indexes of the tokens involved in each text
  originalTokens: number[];
  studentTokens: number[];
  expected: string; // words of the dictation
  written: string; // words written by the student ("" when forgotten)
  sentenceIndex: number;
};

export type DictationSentence = {
  index: number;
  studentHighlighted: string;
  originalHighlighted: string;
  errorIds: number[];
};

export type DictationComparison = {
  totalWords: number;
  correctWords: number;
  successPercentage: number;
  errors: DictationErrorUnit[];
  studentHighlighted: string;
  originalHighlighted: string;
  sentences: DictationSentence[];
};

const WORD_REGEX = /[\p{L}\p{N}]+(?:[-‐‑][\p{L}\p{N}]+)*/gu;

function normalizeWord(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[‐‑]/g, "-");
}

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.normalize("NFC").matchAll(WORD_REGEX)) {
    const start = match.index ?? 0;
    tokens.push({
      raw: match[0],
      norm: normalizeWord(match[0]),
      start,
      end: start + match[0].length,
    });
  }
  return tokens;
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

function wordDistance(a: string, b: string): number {
  return levenshtein(a, b) / Math.max(a.length, b.length, 1);
}

// A misspelled word is "close" to the expected one when less than half of it differs
const CLOSE_WORD_DISTANCE = 0.5;

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  // Always cheaper than a deletion + an insertion (2), cheaper for similar words
  return 0.5 + 0.9 * wordDistance(a, b);
}

function align(original: Token[], student: Token[]): Op[] {
  const n = original.length;
  const m = student.length;
  const cost: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0)
  );
  for (let i = 1; i <= n; i++) cost[i][0] = i;
  for (let j = 1; j <= m; j++) cost[0][j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      cost[i][j] = Math.min(
        cost[i - 1][j - 1] +
          substitutionCost(original[i - 1].norm, student[j - 1].norm),
        cost[i - 1][j] + 1,
        cost[i][j - 1] + 1
      );
    }
  }

  const ops: Op[] = [];
  let i = n;
  let j = m;
  const EPSILON = 1e-9;
  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      Math.abs(
        cost[i][j] -
          (cost[i - 1][j - 1] +
            substitutionCost(original[i - 1].norm, student[j - 1].norm))
      ) < EPSILON
    ) {
      const same = original[i - 1].norm === student[j - 1].norm;
      ops.push({ kind: same ? "match" : "sub", o: i - 1, s: j - 1 });
      i--;
      j--;
    } else if (i > 0 && Math.abs(cost[i][j] - (cost[i - 1][j] + 1)) < EPSILON) {
      ops.push({ kind: "del", o: i - 1 });
      i--;
    } else {
      ops.push({ kind: "ins", s: j - 1 });
      j--;
    }
  }
  return ops.reverse();
}

// Groups consecutive non-matching operations into error units.
// A misspelled word close to the expected one is its own error; the rest of
// the run (forgotten/extra/unrecognisable words) is grouped into one error.
function buildErrorGroups(ops: Op[], original: Token[], student: Token[]) {
  const groups: Op[][] = [];
  let pending: Op[] = [];
  const flush = () => {
    if (pending.length > 0) groups.push(pending);
    pending = [];
  };
  for (const op of ops) {
    if (op.kind === "match") {
      flush();
    } else if (
      op.kind === "sub" &&
      wordDistance(original[op.o].norm, student[op.s].norm) <= CLOSE_WORD_DISTANCE
    ) {
      flush();
      groups.push([op]);
    } else if (op.kind === "sub" && pending.every((p) => p.kind === "sub")) {
      // Successive misspelled words stay separate errors
      flush();
      pending.push(op);
    } else {
      pending.push(op);
    }
  }
  flush();
  return groups;
}

function splitSentences(text: string): Array<{ start: number; end: number }> {
  const sentences: Array<{ start: number; end: number }> = [];
  const regex = /[^.!?…]+(?:[.!?…]+["»”)\]]*|$)/g;
  for (const match of text.matchAll(regex)) {
    const start = match.index ?? 0;
    if (match[0].trim().length === 0) continue;
    sentences.push({ start, end: start + match[0].length });
  }
  if (sentences.length === 0) sentences.push({ start: 0, end: text.length });
  return sentences;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_`~[\]#<>])/g, "\\$1");
}

// Rebuilds a slice of text wrapping the given tokens with `marker`
function highlight(
  text: string,
  tokens: Token[],
  highlighted: Set<number>,
  marker: string,
  from = 0,
  to = text.length
): string {
  let result = "";
  let cursor = from;
  tokens.forEach((token, index) => {
    if (token.start < from || token.end > to) return;
    result += escapeMarkdown(text.slice(cursor, token.start));
    result += highlighted.has(index)
      ? `${marker}${token.raw}${marker}`
      : token.raw;
    cursor = token.end;
  });
  result += escapeMarkdown(text.slice(cursor, to));
  return result.trim();
}

export function compareDictation(
  originalText: string,
  studentText: string
): DictationComparison {
  const original = originalText.normalize("NFC");
  const student = studentText.normalize("NFC");
  const originalTokens = tokenize(original);
  const studentTokens = tokenize(student);
  const ops = align(originalTokens, studentTokens);

  const sentenceRanges = splitSentences(original);
  const sentenceOfOriginalToken = originalTokens.map((token) => {
    const index = sentenceRanges.findIndex(
      (range) => token.start >= range.start && token.start < range.end
    );
    return index === -1 ? sentenceRanges.length - 1 : index;
  });

  // Each student token belongs to the sentence of the last original token seen
  const sentenceOfStudentToken = new Array<number>(studentTokens.length).fill(0);
  let currentSentence = 0;
  for (const op of ops) {
    if (op.kind !== "ins") currentSentence = sentenceOfOriginalToken[op.o];
    if (op.kind !== "del") sentenceOfStudentToken[op.s] = currentSentence;
  }

  const errors: DictationErrorUnit[] = buildErrorGroups(
    ops,
    originalTokens,
    studentTokens
  ).map((group, index) => {
    const oIdx = group.flatMap((op) => (op.kind === "ins" ? [] : [op.o]));
    const sIdx = group.flatMap((op) => (op.kind === "del" ? [] : [op.s]));
    return {
      id: index + 1,
      originalTokens: oIdx,
      studentTokens: sIdx,
      expected: oIdx.map((i) => originalTokens[i].raw).join(" "),
      written: sIdx.map((i) => studentTokens[i].raw).join(" "),
      sentenceIndex:
        oIdx.length > 0
          ? sentenceOfOriginalToken[oIdx[0]]
          : sentenceOfStudentToken[sIdx[0]],
    };
  });

  const wrongOriginal = new Set(errors.flatMap((e) => e.originalTokens));
  const wrongStudent = new Set(errors.flatMap((e) => e.studentTokens));

  const correctWords = ops.filter((op) => op.kind === "match").length;
  const totalWords = Math.max(originalTokens.length, studentTokens.length);
  const successPercentage =
    totalWords === 0 ? 100 : Math.round((correctWords / totalWords) * 100);

  const sentences: DictationSentence[] = [];
  sentenceRanges.forEach((range, index) => {
    const errorIds = errors
      .filter((e) => e.sentenceIndex === index)
      .map((e) => e.id);
    if (errorIds.length === 0) return;

    const studentInSentence = studentTokens
      .map((_, i) => i)
      .filter((i) => sentenceOfStudentToken[i] === index);
    let studentHighlighted = "_(phrase oubliée)_";
    if (studentInSentence.length > 0) {
      const first = studentInSentence[0];
      const last = studentInSentence[studentInSentence.length - 1];
      const to =
        last + 1 < studentTokens.length
          ? studentTokens[last + 1].start
          : student.length;
      studentHighlighted = highlight(
        student,
        studentTokens,
        wrongStudent,
        "**",
        studentTokens[first].start,
        to
      );
    }

    sentences.push({
      index,
      studentHighlighted,
      originalHighlighted: highlight(
        original,
        originalTokens,
        wrongOriginal,
        "*",
        range.start,
        range.end
      ),
      errorIds,
    });
  });

  return {
    totalWords,
    correctWords,
    successPercentage,
    errors,
    studentHighlighted: highlight(student, studentTokens, wrongStudent, "**"),
    originalHighlighted: highlight(original, originalTokens, wrongOriginal, "*"),
    sentences,
  };
}
