// Shared by the browser (live counter) and the server (goal check, dictée value).

/** Words of a text: whitespace-separated tokens holding at least one letter or digit. */
export function countWords(text: string) {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/** An expression écrite is worth more than a dictée of the same length: it is extra work. */
export const WRITING_EFFORT_MULTIPLIER = 2;

/** Used when no dictée of the student's level has a word count. */
export const DEFAULT_DICTATION_WORDS = 50;

/** 100 words when dictées average 50 words: 2 × 2 = worth 4 dictées. */
export function dicteeValue(wordCount: number, averageDictationWords: number) {
  const average = averageDictationWords > 0 ? averageDictationWords : DEFAULT_DICTATION_WORDS;
  return Math.round((wordCount / average) * WRITING_EFFORT_MULTIPLIER * 10) / 10;
}

/** Sentences read one by one, like a dictée. */
export function splitSentences(text: string) {
  return (text.replace(/\s+/g, " ").match(/[^.!?…]+(?:[.!?…]+["»)]?|$)/g) ?? [])
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
}
