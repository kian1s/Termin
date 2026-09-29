import { Lang, Level, LEVELS, WordEntry } from '@/lib/types';
import { allWords, shuffled } from '@/lib/words';

// SPEC 4.14: a short offline quiz that suggests a CEFR level. 12 questions,
// 3 per level from B1 to C2, each with 4 definitions and "I don't know".

export const QUESTIONS_PER_LEVEL = 3;
const PASS = 2; // correct answers out of 3 to pass a level

export type Question = { word: WordEntry; options: string[]; answer: string };

// Picks words at random from the whole dataset, ignoring Premium gating (the
// test only shows the word and definitions). Distractors are definitions of
// other words of the same level and language.
export function buildTest(lang: Lang): Question[] {
  const words = allWords(lang);
  return LEVELS.flatMap((level) => {
    const pool = words.filter((w) => w.level === level);
    return shuffled(pool)
      .slice(0, QUESTIONS_PER_LEVEL)
      .map((word) => {
        const distractors = shuffled(pool.filter((w) => w.id !== word.id && w.definition !== word.definition))
          .map((w) => w.definition)
          .filter((d, i, all) => all.indexOf(d) === i)
          .slice(0, 3);
        return { word, answer: word.definition, options: shuffled([word.definition, ...distractors]) };
      });
  });
}

export type LevelScore = { level: Level; correct: number };

// `results[i]` is true when question i was answered correctly ("I don't know"
// counts as wrong). Questions are in level order, 3 per level.
export function scoreTest(results: boolean[]): { scores: LevelScore[]; suggested: Level } {
  const scores = LEVELS.map((level, i) => ({
    level,
    correct: results.slice(i * QUESTIONS_PER_LEVEL, (i + 1) * QUESTIONS_PER_LEVEL).filter(Boolean).length,
  }));
  // The highest level reached by passing every level below it too. If B1 is
  // not passed, suggest B1.
  let suggested: Level = 'B1';
  for (const s of scores) {
    if (s.correct < PASS) break;
    suggested = s.level;
  }
  return { scores, suggested };
}
