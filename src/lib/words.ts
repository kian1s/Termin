import { Lang, Settings, WordEntry } from '@/lib/types';

// Words are bundled with the app, generated and checked by scripts/dataset.
const WORDS: Record<Lang, WordEntry[]> = {
  en: require('../../data/words/en.json'),
  fr: require('../../data/words/fr.json'),
  de: require('../../data/words/de.json'),
  es: require('../../data/words/es.json'),
  pt: require('../../data/words/pt.json'),
};

export function wordsFor(settings: Settings): WordEntry[] {
  return WORDS[settings.learningLang].filter(
    (w) => w.level === settings.level && settings.categories.includes(w.category)
  );
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
