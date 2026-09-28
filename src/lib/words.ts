import { Lang, Settings, WordEntry } from '@/lib/types';

// Words are bundled with the app. Phase 1 ships ~15 English sample words;
// the other languages are filled in Phase 3.
const WORDS: Record<Lang, WordEntry[]> = {
  en: require('../../data/words/en.json'),
  fr: [],
  de: [],
  es: [],
  pt: [],
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
