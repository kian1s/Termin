// Converts hand-written word lists (data/manual/src/<lang>.txt) into
// data/manual/<lang>.json, then runs the free script checks on them.
//
//   node scripts/dataset/manual.ts
//
// One entry per line, fields separated by "|":
// level|category|word|partOfSpeech|definition|example|then word|definition
// for each other language in the order en, fr, de, es, pt (skipping its own).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { saveWiktionaryCache, scriptFlags, wiktionaryFlag } from './checks.ts';
import { LANGS, ROOT, type Category, type Lang, type Level, type WordEntry } from './config.ts';

const dir = new URL('data/manual/', ROOT);
let problems = 0;

for (const lang of LANGS) {
  const src = new URL(`src/${lang}.txt`, dir);
  if (!existsSync(src)) continue;
  const others = LANGS.filter((l) => l !== lang);
  const counters: Record<string, number> = {};
  const entries: WordEntry[] = [];
  for (const [i, line] of readFileSync(src, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    const f = line.split('|').map((s) => s.trim());
    if (f.length !== 6 + others.length * 2) {
      console.error(`  ${lang} line ${i + 1}: expected ${6 + others.length * 2} fields, got ${f.length}`);
      problems++;
      continue;
    }
    const [level, category, word, partOfSpeech, definition, example] = f;
    const key = `${level}-${category}`;
    counters[key] = (counters[key] ?? 0) + 1;
    const translations: WordEntry['translations'] = {};
    others.forEach((l, j) => (translations[l] = { word: f[6 + j * 2], definition: f[7 + j * 2] }));
    entries.push({
      id: `${lang}-${level.toLowerCase()}-${category}-m${String(counters[key]).padStart(2, '0')}`,
      lang: lang as Lang,
      level: level as Level,
      category: category as Category,
      word,
      partOfSpeech,
      definition,
      example,
      translations,
    });
  }
  for (const e of entries) {
    const { flags, hints } = scriptFlags(e);
    const copied = await wiktionaryFlag(e);
    for (const flag of [...flags, ...(copied ? [copied] : [])]) {
      console.log(`  ${e.id} ${e.word}: ${flag.severity} ${flag.type}: ${flag.reason}`);
      problems++;
    }
    for (const h of hints) console.log(`  ${e.id} ${e.word}: note: ${h}`);
  }
  writeFileSync(new URL(`${lang}.json`, dir), JSON.stringify(entries, null, 2) + '\n');
  console.log(`${lang}: ${entries.length} entries`);
}
saveWiktionaryCache();
console.log(problems ? `${problems} problem(s) to look at.` : 'No problems found.');
