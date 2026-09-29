export const LANGS = ['en', 'fr', 'de', 'es', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

export const LEVELS = ['B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export const CATEGORIES = ['academic', 'everyday', 'work', 'idioms'] as const;
export type Category = (typeof CATEGORIES)[number];

export const LANG_NAMES: Record<Lang, string> = {
  en: 'English',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pt: 'Portuguese',
};

// Voice used by expo-speech for each learning language.
export const SPEECH_VOICES: Record<Lang, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
  pt: 'pt-PT',
};

export const CATEGORY_NAMES: Record<Category, string> = {
  academic: 'Academic',
  everyday: 'Everyday',
  work: 'Work',
  idioms: 'Idioms',
};

export type WordEntry = {
  id: string;
  lang: Lang;
  level: Level;
  category: Category;
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  translations: Partial<Record<Lang, { word: string; definition: string }>>;
};

export type Reminder = { enabled: boolean; hour: number; minute: number };

// Which language the AI Coach writes its feedback in.
export type CoachLanguage = 'native' | 'learning' | Lang;

export type Settings = {
  learningLang: Lang;
  nativeLang: Lang;
  level: Level;
  categories: Category[];
  reminder: Reminder;
  coachLanguage?: CoachLanguage; // missing means 'native'
};

export function coachFeedbackLang(s: Settings): Lang {
  const c = s.coachLanguage ?? 'native';
  return c === 'native' ? s.nativeLang : c === 'learning' ? s.learningLang : c;
}

export const FAVORITES_ID = 'favorites';

export type WordSet = { id: string; name: string; wordIds: string[] };

// Leitner box for a saved word. Box 1 is due after a number of feed cards,
// boxes 2–4 after a number of days.
export type ReviewState = { box: 1 | 2 | 3 | 4; dueAtCard: number; dueAt: number };

export type Stats = {
  cardsViewed: number; // all-time feed cards viewed, used for box 1 scheduling
  day: string; // local date (YYYY-MM-DD) that viewsToday/reviewsToday belong to
  viewsToday: number;
  reviewsToday: number;
  streak: number;
  best: number;
  lastActive: string | null; // last local date that counted toward the streak
};
