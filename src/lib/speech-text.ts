// Shared by the server (ElevenLabs) and the browser (device voice).

/** Markdown and layout characters must not be read aloud. */
export function cleanTextForSpeech(text: string) {
  return text
    .replace(/_{3,}/g, " … ") // blanks of a fill-in sentence
    .replace(/\*\*|__|[*_`#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
