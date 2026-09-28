export const LANGS = ['en', 'fr', 'de', 'es', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

export const LEVELS = ['B1', 'B2', 'C1', 'C2'] as const;
export type Level = (typeof LEVELS)[number];

export const CATEGORIES = ['academic', 'debate', 'idioms'] as const;
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
  debate: 'Debate',
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

export type Settings = {
  learningLang: Lang;
  nativeLang: Lang;
  level: Level;
  categories: Category[];
  reminder: Reminder;
};
