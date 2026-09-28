/// <reference types="node" />
// Settings for the word dataset pipeline (see DATASET.md).
import type { Category, Lang, Level } from '../../src/lib/types.ts';

export { CATEGORIES, LANGS, LANG_NAMES, LEVELS } from '../../src/lib/types.ts';
export type { Category, Lang, Level, WordEntry } from '../../src/lib/types.ts';

// Generator candidates (model A). The test batch runs both on the same words.
// (Mistral Large was dropped: rate-limited upstream on OpenRouter, Sep 28.)
export const GENERATORS: Record<string, string> = {
  luna: 'openai/gpt-6-luna-pro',
  mimo: 'xiaomi/mimo-v2.6-pro',
  gemini: 'google/gemini-3.8-flash',
};

// Picks the test batch's candidate words, so every generator gets the same words.
export const TEST_PICKER = 'luna';

// Checker (model B). Must come from a different company than the generator.
// GLM 5.3 Flash was tried first: its forced reasoning made some reviews take
// minutes, and it flagged correct translations as wrong.
export const CHECKER = 'google/gemini-3.8-flash';

// Tracked spend stops the scripts here. The key itself has a $10 limit.
export const STOP_AT_USD = 9.5; // raised from $8 with the owner's OK (Sep 28): Gemini reviews cost more than estimated

// Max words per (language, category, level). A cap, never a quota.
export const CAPS: Record<Category, Record<Level, number>> = {
  academic: { B1: 25, B2: 40, C1: 40, C2: 30 },
  everyday: { B1: 30, B2: 40, C1: 35, C2: 25 },
  work: { B1: 20, B2: 30, C1: 30, C2: 20 },
  idioms: { B1: 15, B2: 30, C1: 35, C2: 30 },
};

// The test batch: 10 words each of C1 Academic and B1 Idioms (the plan), plus
// B2 Everyday and C2 Academic to compare generators across levels. All languages.
export const TEST_COMBOS: { category: Category; level: Level; cap: number }[] = [
  { category: 'academic', level: 'C1', cap: 10 },
  { category: 'idioms', level: 'B1', cap: 10 },
  { category: 'everyday', level: 'B2', cap: 10 },
  { category: 'academic', level: 'C2', cap: 10 },
];

// How each language is named in prompts, including the required variant.
export const LANG_PROMPT: Record<Lang, string> = {
  en: 'English',
  fr: 'French (France French)',
  de: 'German',
  es: 'Spanish (Spain Spanish, not Latin American)',
  pt: 'Portuguese (European Portuguese from Portugal, not Brazilian)',
};

export const CATEGORY_PROMPT: Record<Category, string> = {
  academic:
    'Academic: words for essays, analysis, argument, giving opinions, and linking ideas (e.g. undermine, whereas, substantiate, concede, rebut).',
  everyday:
    'Everyday: words and expressions for natural conversation, including common collocations, phrasal verbs (English only) and register (e.g. put up with, awkward, to be fed up).',
  work: 'Work: words for meetings, emails, negotiation and the workplace (e.g. follow up, leverage, deadline).',
  idioms:
    'Idioms: fixed expressions with a non-literal meaning that native speakers really use (e.g. a blessing in disguise).',
};

// Articles and small words ignored when matching headwords.
export const ARTICLES: Record<Lang, string[]> = {
  en: ['the', 'a', 'an', 'to'],
  fr: ['le', 'la', 'les', 'l', 'un', 'une', 'se', 's'],
  de: ['der', 'die', 'das', 'sich', 'ein', 'eine'],
  es: ['el', 'la', 'los', 'las', 'un', 'una', 'se'],
  pt: ['o', 'a', 'os', 'as', 'um', 'uma', 'se'],
};

export const ROOT = new URL('../../', import.meta.url);
export const PIPELINE_DIR = new URL('data/pipeline/', ROOT);
export const REVIEW_DIR = new URL('data/review/', ROOT);
export const WORDS_DIR = new URL('data/words/', ROOT);
