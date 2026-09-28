import { CATEGORIES, CATEGORY_NAMES, LANG_NAMES, LANGS, LEVELS, Settings } from '@/lib/types';

export type Field = 'learningLang' | 'nativeLang' | 'level' | 'categories';

export const FIELDS: Field[] = ['learningLang', 'nativeLang', 'level', 'categories'];

const LEVEL_HINTS = {
  B1: 'B1 · Intermediate',
  B2: 'B2 · Upper intermediate',
  C1: 'C1 · Advanced',
  C2: 'C2 · Mastery',
};

// Question text and options for each setting, shared by onboarding and Settings.
export function questionFor(field: Field, draft: Partial<Settings>) {
  switch (field) {
    case 'learningLang':
      return {
        question: 'Which language are you learning?',
        multi: false,
        options: LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] })),
      };
    case 'nativeLang':
      return {
        question: 'What is your native language?',
        hint: 'Used for translations and feedback.',
        multi: false,
        options: LANGS.filter((l) => l !== draft.learningLang).map((l) => ({
          value: l,
          label: LANG_NAMES[l],
        })),
      };
    case 'level':
      return {
        question: 'What is your level?',
        multi: false,
        options: LEVELS.map((l) => ({ value: l, label: LEVEL_HINTS[l] })),
      };
    case 'categories':
      return {
        question: 'What do you need words for?',
        hint: 'Pick one or more.',
        multi: true,
        options: CATEGORIES.map((c) => ({ value: c, label: CATEGORY_NAMES[c] })),
      };
  }
}

export function selectedFor(field: Field, draft: Partial<Settings>): string[] {
  if (field === 'categories') return draft.categories ?? [];
  const v = draft[field];
  return v ? [v] : [];
}

// Applies a chip tap to the draft. Picking the native language as the learning
// language swaps the two, so they always differ.
export function toggle(field: Field, draft: Partial<Settings>, value: string): Partial<Settings> {
  if (field === 'categories') {
    const cur = draft.categories ?? [];
    const next = cur.includes(value as never)
      ? cur.filter((c) => c !== value)
      : [...cur, value as (typeof cur)[number]];
    return { ...draft, categories: next };
  }
  if (field === 'learningLang' && value === draft.nativeLang) {
    return { ...draft, learningLang: draft.nativeLang, nativeLang: draft.learningLang };
  }
  return { ...draft, [field]: value };
}
