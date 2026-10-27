// Single source of truth for the OpenAI models used across the app.
// To switch models, change these values only.

// Fast & cheap: dictation explanations, session reports, open-answer grading.
export const AI_MODEL_FAST = "gpt-6-luna";

// Vision + careful writing: reading workbook photos, generating exercises.
export const AI_MODEL_SMART = "gpt-6.1-terra";

// Speech-to-text: dictation of chat messages when the browser can't transcribe.
export const AI_MODEL_TRANSCRIBE = "gpt-4o-transcribe";
