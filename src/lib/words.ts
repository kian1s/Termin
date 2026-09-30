import { Category, Lang, Level, Settings, WordEntry } from '@/lib/types';

// Words are bundled with the app, generated and checked by scripts/dataset.
const WORDS: Record<Lang, WordEntry[]> = {
  en: require('../../data/words/en.json'),
  fr: require('../../data/words/fr.json'),
  de: require('../../data/words/de.json'),
  es: require('../../data/words/es.json'),
  pt: require('../../data/words/pt.json'),
};

export function wordsFor(settings: Settings): WordEntry[] {
  return wordsAt(settings.learningLang, settings.level, settings.categories);
}

export function wordsAt(lang: Lang, level: Level, categories: Category[]): WordEntry[] {
  return WORDS[lang].filter((w) => w.level === level && categories.includes(w.category));
}

export function allWords(lang: Lang): WordEntry[] {
  return WORDS[lang];
}

// Fisher–Yates shuffle that avoids starting with `avoidFirst`, so a new round
// never repeats the last card of the previous round back to back.
export function shuffled<T>(items: T[], avoidFirst?: T): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.length > 1 && out[0] === avoidFirst) {
    [out[0], out[out.length - 1]] = [out[out.length - 1], out[0]];
  }
  return out;
}

const BY_ID = new Map(Object.values(WORDS).flat().map((w) => [w.id, w]));

export function wordById(id: string): WordEntry | undefined {
  return BY_ID.get(id);
}

// AI-made cards (SPEC 4.19) live in the app state; they are registered here so
// every screen finds them by ID like dataset words. They never enter the feed.
export function registerCustomWords(words: WordEntry[]) {
  for (const w of words) BY_ID.set(w.id, w);
}
