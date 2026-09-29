import { Category, LANGS, Level, LEVELS, ReviewState, WordEntry } from '@/lib/types';
import { allWords } from '@/lib/words';

// SPEC 5: Premium unlocks the Idioms and Work categories and the rest of the
// C1 and C2 words. Free users get fixed shares, the same words every time:
// all of B1 and B2, part of C1 and C2, and a few samples of each Premium category.
const PREMIUM_CATEGORIES: Category[] = ['idioms', 'work'];
const FREE_SHARE: Partial<Record<Level, Partial<Record<Category, number>>>> = {
  C1: { everyday: 2 / 3, academic: 1 / 4 },
  C2: { everyday: 1 / 2, academic: 1 / 2 },
};
const SAMPLES_PER_PREMIUM_CATEGORY = 3; // per language and level
export const FREE_CUSTOM_SETS = 2;

export const isPremiumCategory = (category: Category) => PREMIUM_CATEGORIES.includes(category);

// Word IDs within a (language, category, level) group are ordered by pick
// quality, so the free share is the first part of each group.
const FREE_IDS = (() => {
  const free = new Set<string>();
  for (const lang of LANGS) {
    const groups = new Map<string, WordEntry[]>();
    for (const w of allWords(lang)) {
      const key = `${w.category}|${w.level}`;
      groups.set(key, [...(groups.get(key) ?? []), w]);
    }
    for (const words of groups.values()) {
      const { category, level } = words[0];
      const sorted = [...words].sort((a, b) => a.id.localeCompare(b.id));
      const count = isPremiumCategory(category)
        ? SAMPLES_PER_PREMIUM_CATEGORY
        : Math.round(sorted.length * (FREE_SHARE[level]?.[category] ?? 1));
      for (const w of sorted.slice(0, count)) free.add(w.id);
    }
  }
  return free;
})();

export const isFreeWord = (w: WordEntry) => FREE_IDS.has(w.id);
export const isLockedWord = (w: WordEntry, isPremium: boolean) => !isPremium && !isFreeWord(w);

export function levelAbove(level: Level): Level | null {
  return LEVELS[LEVELS.indexOf(level) + 1] ?? null;
}

// SPEC 4.12: how often a stretch card from one level up appears, from the
// last 20 review answers and the Leitner boxes. null means no stretch cards.
export function stretchEvery(
  recent: boolean[],
  reviews: Record<string, ReviewState>,
  simulateStrong: boolean
): number | null {
  if (simulateStrong) return 5;
  const last = recent.slice(-20);
  if (last.length < 10) return null;
  const accuracy = last.filter(Boolean).length / last.length;
  if (accuracy >= 0.9) return 5;
  const settled = Object.values(reviews).filter((r) => r.box >= 3).length;
  if (accuracy >= 0.8 && settled >= 15) return 8;
  return null;
}

// Free users see at most one locked teaser card in every 15 cards.
export const TEASER_EVERY = 15;
