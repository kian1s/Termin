// Prompts for each model stage. The writing rules follow DATASET.md.
import {
  CATEGORY_PROMPT,
  LANG_PROMPT,
  LANGS,
  type Category,
  type Lang,
  type Level,
} from './config.ts';

const ARTICLE_RULE =
  'Nouns in German, French, Spanish and Portuguese include their definite article (die Nachhaltigkeit, le défi, el reto, o desafio).';

const HEADWORD_RULE =
  "Write headwords the way a dictionary lists them: no grammar notes such as '(e)' or '+ infinitive', and no slashes.";

// Stops a category like Everyday from coming back as only phrasal verbs.
const PICK_MIX: Partial<Record<Category, (lang: Lang) => string>> = {
  everyday: (lang) =>
    `Mix types: ${lang === 'en' ? 'phrasal verbs, ' : ''}collocations (like "make a decision"), useful adjectives and verbs, and common conversational expressions.`,
  work: () => 'Mix types: nouns, verbs, collocations and common workplace expressions.',
};

// Stage 1 (model A): bare candidate words for one language and category.
export function pickPrompt(lang: Lang, category: Category, counts: Partial<Record<Level, number>>) {
  const wanted = Object.entries(counts)
    .map(([level, n]) => `"${level}": up to ${n}`)
    .join(', ');
  return [
    {
      role: 'system' as const,
      content: `You are an expert ${LANG_PROMPT[lang]} teacher choosing vocabulary for Wordloop, an app for B1 to C2 learners.`,
    },
    {
      role: 'user' as const,
      content: `List candidate headwords in ${LANG_PROMPT[lang]} for this category:
${CATEGORY_PROMPT[category]}${lang === 'en' ? '' : `
The examples above are English; list items in ${LANG_PROMPT[lang]}.`}

How many per CEFR level: ${wanted}.

Rules:
- Only common, genuinely useful words or expressions that a learner at exactly that CEFR level should learn next. No rare, archaic, slang-only or overly technical items.
- Every item fits the category and is natural in ${LANG_PROMPT[lang]}.
- No item appears twice, in any level.
- ${HEADWORD_RULE}${PICK_MIX[category] ? `
- ${PICK_MIX[category]!(lang)}` : ''}
- Fewer is fine. Never pad the list with weak items to reach the number.
- ${lang === 'en' ? 'Verbs without "to".' : ARTICLE_RULE}

Return only JSON, with one array per level: {${Object.keys(counts)
        .map((l) => `"${l}": ["..."]`)
        .join(', ')}}`,
    },
  ];
}

// Stage 2 (model B): score each candidate's fit.
export function filterPrompt(lang: Lang, category: Category, items: { level: Level; word: string }[]) {
  return [
    {
      role: 'system' as const,
      content: `You are a strict ${LANG_PROMPT[lang]} examiner checking vocabulary lists for a learner app.`,
    },
    {
      role: 'user' as const,
      content: `Category: ${CATEGORY_PROMPT[category]}
Language: ${LANG_PROMPT[lang]}

Score every item below from 1 to 5 for how good it is at its CEFR level in this category:
5 = excellent: common, useful, clearly this level, clearly this category, natural in this language variant
3 = acceptable but weaker
1 = reject: not real or not natural, wrong level by more than one step, wrong category, wrong language variant, or rare, archaic or technical

Items (level | word):
${items.map((i) => `${i.level} | ${i.word}`).join('\n')}

Return only JSON listing every item in the same order: {"items": [{"level": "B2", "word": "...", "fit": 4}]}`,
    },
  ];
}

export type DraftEntry = {
  word: string;
  partOfSpeech: string;
  definition: string;
  example: string;
  translations: Partial<Record<Lang, { word: string; definition: string }>>;
};

function writingRules(lang: Lang, category: Category) {
  const others = LANGS.filter((l) => l !== lang);
  return `Learning language: ${LANG_PROMPT[lang]}
Category: ${CATEGORY_PROMPT[category]}

Rules:
- "definition" and "example" are in ${LANG_PROMPT[lang]}.
- The definition uses simpler words than the headword, does not contain the headword, and is under 20 words.
- The example is 8 to 20 words, sounds natural, contains the headword (any grammatical form), and makes the meaning clear from context.
- Everything is original. Never quote or closely paraphrase dictionaries, books, films, songs or famous lines.
- Spanish is Spain Spanish, Portuguese is European Portuguese, French is France French. This also applies inside translations.
- ${ARTICLE_RULE} This applies to the headword and to noun translations.
- ${HEADWORD_RULE}
- "translations" has exactly these keys: ${others.join(', ')}. Each has "word" (the natural equivalent in that language: a real headword in dictionary form, infinitive for verbs, never a description) and "definition" (a short definition in that language, under 20 words).
- ${category === 'idioms' ? 'Idiom translations: most common idioms have an equivalent idiom in the other languages. Use it. Give a short plain explanation only when no equivalent idiom exists. Never translate word for word.' : 'If no single word matches, use the most natural short phrase.'}
- "partOfSpeech" is one of: noun, verb, adjective, adverb, conjunction, preposition, phrasal verb, expression, idiom (in English).
- Keep each headword as given (you may add the article to a noun, or remove grammar notes). If a headword is not a good fit (not real, wrong level, not useful), leave it out instead of forcing it.

Return only JSON: {"entries": [{"word": "...", "partOfSpeech": "...", "definition": "...", "example": "...", "translations": {${others
    .map((l) => `"${l}": {"word": "...", "definition": "..."}`)
    .join(', ')}}}]}`;
}

// Stage 3 (model A): full entries for up to 10 words.
export function writePrompt(lang: Lang, category: Category, level: Level, words: string[]) {
  return [
    {
      role: 'system' as const,
      content: `You are an expert ${LANG_PROMPT[lang]} lexicographer and teacher writing original entries for Wordloop, a vocabulary app for advanced learners.`,
    },
    {
      role: 'user' as const,
      content: `${writingRules(lang, category)}

Write one entry for each of these ${level} headwords:
${words.map((w) => `- ${w}`).join('\n')}`,
    },
  ];
}

// Stage 6 (model A): rewrite entries that got a serious flag, using the reason.
export function retryPrompt(
  lang: Lang,
  category: Category,
  level: Level,
  items: { entry: DraftEntry; reasons: string[] }[]
) {
  return [
    {
      role: 'system' as const,
      content: `You are an expert ${LANG_PROMPT[lang]} lexicographer and teacher writing original entries for Wordloop, a vocabulary app for advanced learners.`,
    },
    {
      role: 'user' as const,
      content: `${writingRules(lang, category)}

These ${level} entries were rejected by a reviewer. Write a new, corrected entry for each headword, fixing every problem listed. Write fresh wording rather than editing the old text.

${items
  .map((i) => `Headword: ${i.entry.word}\nProblems: ${i.reasons.join(' / ')}\nOld entry: ${JSON.stringify(i.entry)}`)
  .join('\n\n')}`,
    },
  ];
}

export type ModelFlag = {
  id: string;
  severity: 'serious' | 'minor';
  type: string;
  reason: string;
};

// Stage 5 (model B): flag problems only, never rewrite.
export function reviewPrompt(
  lang: Lang,
  category: Category,
  level: Level,
  entries: ({ id: string } & DraftEntry)[],
  hints: Record<string, string[]>
) {
  const hintLines = Object.entries(hints)
    .map(([id, h]) => `- ${id}: ${h.join(' / ')}`)
    .join('\n');
  return [
    {
      role: 'system' as const,
      content:
        'You are a strict multilingual reviewer (English, French, German, Spanish, Portuguese) checking entries for a vocabulary app. You only report problems. You never rewrite entries.',
    },
    {
      role: 'user' as const,
      content: `Learning language: ${LANG_PROMPT[lang]}. Level: ${level}. Category: ${CATEGORY_PROMPT[category]}

Check every entry: the definition, the example, the level, the category, and every translation (word and definition).

Serious problems (type in brackets):
- wrong or misleading meaning (meaning)
- a wrong translation, including a word-for-word idiom translation (translation)
- wrong language variant: Latin American Spanish, Brazilian Portuguese, or non-France French (variant)
- clearly the wrong category (category)
- sounds copied from a dictionary, book, film or famous line (copied)
- the example does not actually use the headword (example-missing)

Minor problems:
- level slightly off, one step (level)
- awkward or unnatural phrasing, a missing noun article, or grammar notes such as '(e)' or '+ infinitive' in a headword (phrasing)
- an idiom translated with a plain explanation although a well-known equivalent idiom exists in that language (idiom-plain)
- weak example that does not show the meaning (example)

${hintLines ? `Notes from automatic checks, confirm or ignore:\n${hintLines}\n\n` : ''}Entries:
${JSON.stringify(entries)}

Return only JSON: {"flags": [{"id": "...", "severity": "serious" or "minor", "type": "...", "reason": "short reason in English"}]}
Report only real problems. If every entry is fine, return {"flags": []}.`,
    },
  ];
}
