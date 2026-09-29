import { isPremiumCategory } from '@/lib/gating';
import { CATEGORIES, CATEGORY_NAMES, LANG_NAMES, LANGS, LEVELS, Settings } from '@/lib/types';

export type Field = 'learningLang' | 'nativeLang' | 'level' | 'categories' | 'coachLanguage';

// Asked during onboarding.
export const FIELDS: Field[] = ['learningLang', 'nativeLang', 'level', 'categories'];
// Editable in Settings.
export const EDIT_FIELDS: Field[] = [...FIELDS, 'coachLanguage'];

const LEVEL_HINTS = {
  B1: 'B1 · Intermediate',
  B2: 'B2 · Upper intermediate',
  C1: 'C1 · Advanced',
  C2: 'C2 · Mastery',
};

// Question text and options for each setting, shared by onboarding and Settings.
// Categories that need Premium are marked `locked` for free users.
export function questionFor(field: Field, draft: Partial<Settings>, isPremium: boolean) {
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
        hint: 'Used for translations and feedback. It can be the same as the language you are learning; cards then show no translation.',
        multi: false,
        options: LANGS.map((l) => ({ value: l, label: LANG_NAMES[l] })),
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
        options: CATEGORIES.map((c) => ({
          value: c,
          label: CATEGORY_NAMES[c],
          locked: !isPremium && isPremiumCategory(c),
        })),
      };
    case 'coachLanguage': {
      const native = draft.nativeLang;
      const learning = draft.learningLang;
      return {
        question: 'Which language should the AI Coach answer in?',
        hint: 'Its feedback is written in this language. Example sentences stay in the language you are learning.',
        multi: false,
        options: [
          { value: 'native', label: `Your native language${native ? ` (${LANG_NAMES[native]})` : ''}` },
          ...(learning !== native
            ? [{ value: 'learning', label: `The language you're learning${learning ? ` (${LANG_NAMES[learning]})` : ''}` }]
            : []),
          ...LANGS.filter((l) => l !== native && l !== learning).map((l) => ({ value: l, label: LANG_NAMES[l] })),
        ],
      };
    }
  }
}

export function selectedFor(field: Field, draft: Partial<Settings>): string[] {
  if (field === 'categories') return draft.categories ?? [];
  if (field === 'coachLanguage') return [draft.coachLanguage ?? 'native'];
  const v = draft[field];
  return v ? [v] : [];
}

// Applies a chip tap to the draft. The native and learning language may be the
// same, e.g. a native English speaker building advanced English vocabulary.
export function toggle(field: Field, draft: Partial<Settings>, value: string): Partial<Settings> {
  if (field === 'categories') {
    const cur = draft.categories ?? [];
    const next = cur.includes(value as never)
      ? cur.filter((c) => c !== value)
      : [...cur, value as (typeof cur)[number]];
    return { ...draft, categories: next };
  }
  return { ...draft, [field]: value };
}
