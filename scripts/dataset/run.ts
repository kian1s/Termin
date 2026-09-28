// Word dataset pipeline (DATASET.md). Run from the project root:
//
//   node scripts/dataset/run.ts test                 test batch with every generator
//   node scripts/dataset/run.ts full --gen luna      full run with the chosen generator
//   node scripts/dataset/run.ts build --run full --gen luna
//   node scripts/dataset/run.ts status               spend so far
//
// Add --parallel N to change how many combinations run at once (default 8).
//
// Single stages: pick, write, review, report, build (with --run and --gen).
// Every stage saves to data/pipeline/<run>/ and skips work already on disk,
// so rerunning after a crash or the spend stop continues where it left off.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  CAPS,
  CATEGORIES,
  CHECKER,
  GENERATORS,
  LANGS,
  LEVELS,
  PIPELINE_DIR,
  REVIEW_DIR,
  STOP_AT_USD,
  TEST_COMBOS,
  TEST_PICKER,
  WORDS_DIR,
  type Category,
  type Lang,
  type Level,
  type WordEntry,
} from './config.ts';
import {
  fieldProblems,
  headKey,
  saveWiktionaryCache,
  scriptFlags,
  wiktionaryFlag,
  wiktionaryStats,
  type Flag,
} from './checks.ts';
import { chatJSON, keyInfo, readSpend, SpendLimitError } from './openrouter.ts';
import {
  filterPrompt,
  pickPrompt,
  retryPrompt,
  reviewPrompt,
  writePrompt,
  type DraftEntry,
  type ModelFlag,
} from './prompts.ts';

// --- arguments and files ---

const args = process.argv.slice(2);
const command = args[0];
function option(name: string, fallback: string) {
  const i = args.indexOf(`--${name}`);
  return i > 0 && args[i + 1] ? args[i + 1] : fallback;
}
const run = option('run', command === 'test' ? 'test' : 'full');
const langs = option('langs', LANGS.join(',')).split(',') as Lang[];
// Combinations worked on at the same time. Each has its own words, so running
// more in parallel is faster without repeats or extra tokens. If a provider
// answers 429 (too many requests), the call waits and retries.
const CONCURRENCY = Number(option('parallel', '8'));

function readJSON<T>(url: URL): T | null {
  return existsSync(url) ? (JSON.parse(readFileSync(url, 'utf8')) as T) : null;
}
function writeJSON(url: URL, data: unknown) {
  mkdirSync(new URL('.', url), { recursive: true });
  writeFileSync(url, JSON.stringify(data, null, 2) + '\n');
}
const runDir = new URL(`${run}/`, PIPELINE_DIR);
const genDir = (gen: string) => new URL(`${gen}/`, runDir);

type Combo = { lang: Lang; category: Category; level: Level; cap: number };

function combos(): Combo[] {
  const base =
    run === 'test'
      ? TEST_COMBOS
      : CATEGORIES.flatMap((category) => LEVELS.map((level) => ({ category, level, cap: CAPS[category][level] })));
  return langs.flatMap((lang) => base.map((c) => ({ lang, ...c })));
}
const comboName = (c: { lang: Lang; category: Category; level: Level }) =>
  `${c.lang}-${c.category}-${c.level}`;
const makeId = (c: Combo, n: number) =>
  `${c.lang}-${c.level.toLowerCase()}-${c.category}-${String(n).padStart(3, '0')}`;

async function pool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  let failed = 0;
  let stop: unknown = null;
  async function worker() {
    while (next < items.length && !stop) {
      const item = items[next++];
      try {
        await fn(item);
      } catch (e) {
        if (e instanceof SpendLimitError || (e instanceof Error && /^OpenRouter 40[123]/.test(e.message))) {
          stop = e;
        } else {
          failed++;
          console.error(`  FAILED: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
  }
  await Promise.all(Array.from({ length: limit }, worker));
  if (stop) throw stop;
  if (failed) console.warn(`  ${failed} item(s) failed. Run the same command again to retry them.`);
}

// --- stages 1 and 2: pick and filter candidate words ---

type Picked = Record<string, string[]>; // "academic-C1" → words

async function pick(gen: string) {
  const model = GENERATORS[gen];
  console.log(`\nStages 1–2: pick candidates (${model}), filter (${CHECKER})`);
  const groups = langs.flatMap((lang) =>
    CATEGORIES.map((category) => ({ lang, category, combos: combos().filter((c) => c.lang === lang && c.category === category) }))
  ).filter((g) => g.combos.length);

  await pool(groups, CONCURRENCY, async ({ lang, category, combos: cs }) => {
    const candFile = new URL(`candidates/${lang}-${category}.json`, runDir);
    let cands = readJSON<Partial<Record<Level, string[]>>>(candFile);
    if (!cands) {
      const counts = Object.fromEntries(cs.map((c) => [c.level, Math.ceil(c.cap * 1.5)]));
      cands = await chatJSON<Partial<Record<Level, string[]>>>(model, pickPrompt(lang, category, counts), 0.8);
      writeJSON(candFile, cands);
    }
    const scoredFile = new URL(`scored/${lang}-${category}.json`, runDir);
    if (!readJSON(scoredFile)) {
      const items = cs.flatMap((c) =>
        (cands![c.level] ?? []).filter((w) => typeof w === 'string' && w.trim()).map((word) => ({ level: c.level, word }))
      );
      const { items: scored } = await chatJSON<{ items: { level: string; word: string; fit: number }[] }>(
        CHECKER,
        filterPrompt(lang, category, items),
        0.2
      );
      // Skip malformed items; an unscored candidate gets 0 and is not picked.
      const fit = new Map(
        (scored ?? [])
          .filter((s) => typeof s?.word === 'string')
          .map((s) => [`${s.level}|${headKey(lang, s.word)}`, Number(s.fit) || 0])
      );
      writeJSON(
        scoredFile,
        items.map((i) => ({ ...i, fit: fit.get(`${i.level}|${headKey(lang, i.word)}`) ?? 0 }))
      );
    }
    console.log(`  ${lang} ${category}: candidates scored`);
  });

  // Keep the best-scoring words up to the cap, with no word repeated in a language.
  for (const lang of langs) {
    const pickedFile = new URL(`picked/${lang}.json`, runDir);
    if (readJSON(pickedFile)) continue;
    const missing = groups.filter((g) => g.lang === lang && !existsSync(new URL(`scored/${lang}-${g.category}.json`, runDir)));
    if (missing.length) {
      console.warn(`  ${lang}: not picked yet (${missing.map((g) => g.category).join(', ')} failed). Run again to retry.`);
      continue;
    }
    const seen = new Set<string>();
    const picked: Picked = {};
    for (const category of CATEGORIES) {
      const scored = readJSON<{ level: Level; word: string; fit: number }[]>(
        new URL(`scored/${lang}-${category}.json`, runDir)
      );
      if (!scored) continue;
      for (const c of combos().filter((c) => c.lang === lang && c.category === category)) {
        const best = scored
          .filter((s) => s.level === c.level && s.fit >= 3)
          .sort((a, b) => b.fit - a.fit)
          .filter((s) => {
            const k = headKey(lang, s.word);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          })
          .slice(0, c.cap);
        picked[`${category}-${c.level}`] = best.map((s) => s.word);
      }
    }
    writeJSON(pickedFile, picked);
    const total = Object.values(picked).reduce((n, w) => n + w.length, 0);
    console.log(`  ${lang}: ${total} words picked`);
  }
}

function pickedWords(c: Combo): string[] {
  const picked = readJSON<Picked>(new URL(`picked/${c.lang}.json`, runDir));
  if (!picked) throw new Error(`No picked words for ${c.lang}. Run the pick stage first.`);
  return picked[`${c.category}-${c.level}`] ?? [];
}

// --- stage 3: write entries ---

type EntriesFile = { batchesDone: number; entries: WordEntry[]; skipped: string[] };

function toEntry(c: Combo, id: string, d: DraftEntry): WordEntry {
  const translations: WordEntry['translations'] = {};
  for (const l of LANGS) {
    const t = d.translations?.[l];
    if (l !== c.lang && t) translations[l] = { word: String(t.word ?? '').trim(), definition: String(t.definition ?? '').trim() };
  }
  return {
    id,
    lang: c.lang,
    level: c.level,
    category: c.category,
    word: String(d.word ?? '').trim(),
    partOfSpeech: String(d.partOfSpeech ?? '').trim(),
    definition: String(d.definition ?? '').trim(),
    example: String(d.example ?? '').trim(),
    translations,
  };
}

// Matches a model's reply to the requested headwords (the model may add an article).
function matchDrafts(lang: Lang, wanted: { id: string; word: string }[], drafts: DraftEntry[]) {
  const byKey = new Map((drafts ?? []).filter((d) => d?.word).map((d) => [headKey(lang, d.word), d]));
  return wanted.map((w) => ({ ...w, draft: byKey.get(headKey(lang, w.word)) }));
}

async function write(gen: string) {
  const model = GENERATORS[gen];
  console.log(`\nStage 3: write entries (${model})`);
  await pool(combos(), CONCURRENCY, async (c) => {
    const file = new URL(`entries/${comboName(c)}.json`, genDir(gen));
    const words = pickedWords(c);
    const batches: string[][] = [];
    for (let i = 0; i < words.length; i += 10) batches.push(words.slice(i, i + 10));
    const state = readJSON<EntriesFile>(file) ?? { batchesDone: 0, entries: [], skipped: [] };
    if (state.batchesDone >= batches.length) return;
    for (let b = state.batchesDone; b < batches.length; b++) {
      const wanted = batches[b].map((word, i) => ({ id: makeId(c, b * 10 + i + 1), word }));
      const { entries } = await chatJSON<{ entries: DraftEntry[] }>(
        model,
        writePrompt(c.lang, c.category, c.level, batches[b]),
        0.7
      );
      for (const m of matchDrafts(c.lang, wanted, entries)) {
        if (m.draft) state.entries.push(toEntry(c, m.id, m.draft));
        else state.skipped.push(m.word);
      }
      state.batchesDone = b + 1;
      writeJSON(file, state);
    }
    console.log(`  ${comboName(c)}: ${state.entries.length} entries, ${state.skipped.length} left out`);
  });
}

// --- stages 4 to 6: script checks, model review, one retry ---

type Reviewed = {
  kept: WordEntry[];
  flags: Flag[]; // minor flags on kept entries
  dropped: { entry: WordEntry; reasons: string[] }[];
  retried: number;
};

async function checkRound(c: Combo, entries: WordEntry[]): Promise<Map<string, Flag[]>> {
  const flags = new Map<string, Flag[]>(entries.map((e) => [e.id, []]));
  const hints: Record<string, string[]> = {};
  for (const e of entries) {
    const s = scriptFlags(e);
    flags.get(e.id)!.push(...s.flags);
    if (s.hints.length) hints[e.id] = s.hints;
    const w = await wiktionaryFlag(e);
    if (w) flags.get(e.id)!.push(w);
  }
  for (let i = 0; i < entries.length; i += 10) {
    const batch = entries.slice(i, i + 10);
    const shown = batch.map(({ id, word, partOfSpeech, definition, example, translations }) => ({
      id,
      word,
      partOfSpeech,
      definition,
      example,
      translations,
    }));
    const batchHints = Object.fromEntries(Object.entries(hints).filter(([id]) => batch.some((e) => e.id === id)));
    const res = await chatJSON<{ flags: ModelFlag[] }>(
      CHECKER,
      reviewPrompt(c.lang, c.category, c.level, shown, batchHints),
      0.2
    );
    for (const f of res.flags ?? []) {
      if (!flags.has(f.id)) continue;
      flags.get(f.id)!.push({
        id: f.id,
        severity: f.severity === 'serious' ? 'serious' : 'minor',
        type: String(f.type ?? 'other'),
        reason: String(f.reason ?? ''),
        source: 'model',
      });
    }
  }
  return flags;
}

const isSerious = (fs: Flag[]) => fs.some((f) => f.severity === 'serious');
const reasonsOf = (fs: Flag[]) => fs.filter((f) => f.severity === 'serious').map((f) => `${f.type}: ${f.reason}`);

async function review(gen: string) {
  const model = GENERATORS[gen];
  console.log(`\nStages 4–6: script checks, review (${CHECKER}), retries (${model})`);
  try {
    await pool(combos(), CONCURRENCY, async (c) => {
      const out = new URL(`reviewed/${comboName(c)}.json`, genDir(gen));
      if (readJSON(out)) return;
      const state = readJSON<EntriesFile>(new URL(`entries/${comboName(c)}.json`, genDir(gen)));
      if (!state || state.batchesDone * 10 < pickedWords(c).length) {
        throw new Error(`${comboName(c)}: entries not finished. Run the write stage first.`);
      }
      const first = await checkRound(c, state.entries);
      const result: Reviewed = { kept: [], flags: [], dropped: [], retried: 0 };
      const toRetry: { entry: WordEntry; reasons: string[] }[] = [];
      for (const e of state.entries) {
        const fs = first.get(e.id)!;
        if (isSerious(fs)) toRetry.push({ entry: e, reasons: reasonsOf(fs) });
        else {
          result.kept.push(e);
          result.flags.push(...fs);
        }
      }
      // One automatic retry with the reasons, then drop anything still serious.
      for (let i = 0; i < toRetry.length; i += 10) {
        const batch = toRetry.slice(i, i + 10);
        const { entries } = await chatJSON<{ entries: DraftEntry[] }>(
          model,
          retryPrompt(c.lang, c.category, c.level, batch),
          0.7
        );
        const matched = matchDrafts(
          c.lang,
          batch.map((b) => ({ id: b.entry.id, word: b.entry.word })),
          entries
        );
        const redone = matched.filter((m) => m.draft).map((m) => toEntry(c, m.id, m.draft!));
        result.retried += redone.length;
        const second = redone.length ? await checkRound(c, redone) : new Map<string, Flag[]>();
        for (const b of batch) {
          const again = redone.find((e) => e.id === b.entry.id);
          const fs = again ? second.get(again.id)! : [];
          if (!again) result.dropped.push({ entry: b.entry, reasons: [...b.reasons, 'retry: left out by the generator'] });
          else if (isSerious(fs)) result.dropped.push({ entry: again, reasons: [...b.reasons, ...reasonsOf(fs).map((r) => `retry ${r}`)] });
          else {
            result.kept.push(again);
            result.flags.push(...fs);
          }
        }
      }
      result.kept.sort((a, b) => a.id.localeCompare(b.id));
      writeJSON(out, result);
      console.log(
        `  ${comboName(c)}: ${result.kept.length} kept, ${result.flags.length} minor flags, ${result.retried} retried, ${result.dropped.length} dropped`
      );
    });
  } finally {
    saveWiktionaryCache();
    const w = wiktionaryStats;
    console.log(`  Wiktionary: ${w.lookups} new lookups, ${w.unavailable} unavailable (rerun review to retry those)`);
  }
}

// --- stage 7: owner review report ---

// Seeded random so the sample stays the same when the report is rebuilt.
function seeded(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}
function sample<T>(items: T[], n: number, seed: string) {
  const rand = seeded(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.slice(0, n);
}

// French, Spanish and Portuguese are not reviewed by the owner, so minor flags
// about meaning or translation drop the entry; level flags are kept.
const AUTO_DROP_LANGS: Lang[] = ['fr', 'es', 'pt'];
const MEANING_TYPES = ['meaning', 'translation', 'variant', 'copied', 'category'];
function autoDropped(lang: Lang, flags: Flag[]) {
  return AUTO_DROP_LANGS.includes(lang) && flags.some((f) => MEANING_TYPES.includes(f.type));
}

function loadReviewed(gen: string, lang: Lang) {
  return combos()
    .filter((c) => c.lang === lang)
    .map((c) => ({ c, r: readJSON<Reviewed>(new URL(`reviewed/${comboName(c)}.json`, genDir(gen))) }))
    .filter((x): x is { c: Combo; r: Reviewed } => !!x.r);
}

function entryMarkdown(e: WordEntry, flags: Flag[] = []) {
  const lines = [
    `### ${e.id} · ${e.word}`,
    `*${e.partOfSpeech} · ${e.level} · ${e.category}*`,
    '',
    ...flags.map((f) => `- ⚠️ **${f.type}** (${f.source}): ${f.reason}`),
    ...(flags.length ? [''] : []),
    `**Definition:** ${e.definition}  `,
    `**Example:** ${e.example}`,
    '',
    ...Object.entries(e.translations).map(([l, t]) => `- ${l}: **${t.word}** — ${t.definition}`),
    '',
  ];
  return lines.join('\n');
}

function report(gen: string) {
  console.log(`\nStage 7: review reports in data/review/`);
  for (const lang of langs) {
    const reviewed = loadReviewed(gen, lang);
    if (!reviewed.length) continue;
    const kept = reviewed.flatMap((x) => x.r.kept);
    const flags = reviewed.flatMap((x) => x.r.flags);
    const dropped = reviewed.flatMap((x) => x.r.dropped);
    const flagsOf = (id: string) => flags.filter((f) => f.id === id);
    const flagged = kept.filter((e) => flagsOf(e.id).length);
    const auto = flagged.filter((e) => autoDropped(lang, flagsOf(e.id)));
    const toReview = flagged.filter((e) => !autoDropped(lang, flagsOf(e.id)));
    const owner = !AUTO_DROP_LANGS.includes(lang);
    const perLevel = owner ? 10 : 5;
    const sampled = LEVELS.flatMap((level) =>
      sample(
        kept.filter((e) => e.level === level && !flagsOf(e.id).length),
        perLevel,
        `${run}-${gen}-${lang}-${level}`
      )
    );
    const md = [
      `# Review: ${lang} (run "${run}", generator ${gen})`,
      '',
      `${kept.length} entries kept, ${flagged.length} with minor flags, ${dropped.length} dropped by the pipeline.`,
      '',
      '## How to review',
      '',
      '- Read each entry below. If it is wrong, copy its ID (like `en-c1-academic-003`) into `data/review/drops.txt`, one per line.',
      '- Do not fix entries by hand. Dropped entries are simply left out.',
      owner
        ? `- **Stop rule:** if more than 4 of the ${sampled.length} random entries have real errors, stop and tell Claude Code: the prompt needs fixing before going further.`
        : '- French, Spanish and Portuguese: minor flags about meaning or translation are dropped automatically. The random sample is for a friend who speaks the language (optional).',
      '',
      `## Minor flags to review (${toReview.length})`,
      '',
      ...toReview.map((e) => entryMarkdown(e, flagsOf(e.id))),
      `## Random sample (${sampled.length})`,
      '',
      ...sampled.map((e) => entryMarkdown(e)),
      `## Dropped automatically (${dropped.length + auto.length}), for information only`,
      '',
      ...dropped.map((d) => `- ${d.entry.id} · **${d.entry.word}**: ${d.reasons.join(' / ')}`),
      ...auto.map((e) => `- ${e.id} · **${e.word}**: ${flagsOf(e.id).map((f) => `${f.type}: ${f.reason}`).join(' / ')}`),
      '',
    ].join('\n');
    const file = new URL(`${run}-${gen}-${lang}.md`, REVIEW_DIR);
    mkdirSync(REVIEW_DIR, { recursive: true });
    writeFileSync(file, md);
    console.log(`  data/review/${run}-${gen}-${lang}.md: ${toReview.length} flags, ${sampled.length} sampled`);
  }
}

// --- stage 8: build the app's word files ---

// Definitions start with a capital letter and end with a full stop.
function tidy(text: string) {
  const t = text.trim();
  return (t.charAt(0).toLocaleUpperCase() + t.slice(1)).replace(/([^.!?…])$/, '$1.');
}
function tidyEntry(e: WordEntry): WordEntry {
  const translations: WordEntry['translations'] = {};
  for (const [l, t] of Object.entries(e.translations)) {
    translations[l as Lang] = { word: t.word, definition: tidy(t.definition) };
  }
  return { ...e, definition: tidy(e.definition), translations };
}

function build(gen: string) {
  const dropsFile = new URL('drops.txt', REVIEW_DIR);
  const drops = new Set<string>(
    existsSync(dropsFile)
      ? readFileSync(dropsFile, 'utf8').split(/\s+/).filter((l) => l && !l.startsWith('#'))
      : []
  );
  // Hand-checked corrections, applied over the pipeline's entries: { "<id>": { "definition": "..." } }.
  const fixes = readJSON<Record<string, Partial<WordEntry>>>(new URL('fixes.json', REVIEW_DIR)) ?? {};
  const outDir = run === 'full' ? WORDS_DIR : new URL('words/', genDir(gen));
  console.log(`\nStage 8: build word files (${run === 'full' ? 'data/words' : `data/pipeline/${run}/${gen}/words`})`);
  for (const lang of langs) {
    const reviewed = loadReviewed(gen, lang);
    if (!reviewed.length) continue;
    const flags = reviewed.flatMap((x) => x.r.flags);
    const ids = new Set<string>();
    const words = new Set<string>();
    const out: WordEntry[] = [];
    // Hand-written words (data/manual/<lang>.json) are added after the generated ones.
    const manual = readJSON<WordEntry[]>(new URL(`../manual/${lang}.json`, REVIEW_DIR)) ?? [];
    for (const kept of [...reviewed.flatMap((x) => x.r.kept), ...manual]) {
      const fix = fixes[kept.id] ?? {};
      const translations = { ...kept.translations };
      for (const [l, t] of Object.entries(fix.translations ?? {})) {
        translations[l as Lang] = { ...kept.translations[l as Lang]!, ...t };
      }
      const e: WordEntry = { ...kept, ...fix, translations };
      if (drops.has(e.id) || autoDropped(lang, flags.filter((f) => f.id === e.id))) continue;
      const problems = fieldProblems(e);
      const key = headKey(lang, e.word);
      if (problems.length) throw new Error(`${e.id}: ${problems.join(', ')}`);
      if (ids.has(e.id)) throw new Error(`Duplicate ID ${e.id}`);
      if (words.has(key)) {
        console.warn(`  ${e.id}: "${e.word}" repeats an earlier word, left out`);
        continue;
      }
      ids.add(e.id);
      words.add(key);
      out.push(tidyEntry(e));
    }
    writeJSON(new URL(`${lang}.json`, outDir), out);
    const counts = LEVELS.map((l) => `${l} ${out.filter((e) => e.level === l).length}`).join(', ');
    console.log(`  ${lang}: ${out.length} entries (${counts})`);
  }
}

// --- commands ---

async function status() {
  const s = readSpend();
  console.log(`Tracked spend: $${s.total.toFixed(4)} of the $${STOP_AT_USD} stop`);
  for (const [m, usd] of Object.entries(s.byModel)) console.log(`  ${m}: $${usd.toFixed(4)}`);
  const key = await keyInfo();
  console.log(`OpenRouter key usage: $${key.usage.toFixed(4)}, limit: ${key.limit ?? 'none'}`);
}

function genOption() {
  const gen = option('gen', 'luna');
  if (!GENERATORS[gen]) throw new Error(`Unknown generator "${gen}". Options: ${Object.keys(GENERATORS).join(', ')}`);
  return gen;
}

async function main() {
  const gen = genOption();
  switch (command) {
    case 'test':
      await pick(TEST_PICKER);
      for (const g of Object.keys(GENERATORS)) {
        await write(g);
        await review(g);
        report(g);
        build(g);
      }
      break;
    case 'full':
      await pick(gen);
      await write(gen);
      await review(gen);
      report(gen);
      break;
    case 'pick':
      await pick(gen);
      break;
    case 'write':
      await write(gen);
      break;
    case 'review':
      await review(gen);
      break;
    case 'report':
      report(gen);
      break;
    case 'build':
      build(gen);
      break;
    case 'status':
      break;
    default:
      console.log('Commands: test, full, pick, write, review, report, build, status. See the top of this file.');
      return;
  }
  await status();
}

main().catch((e) => {
  console.error(`\n${e instanceof Error ? e.message : e}`);
  if (e instanceof SpendLimitError) console.error('Raise STOP_AT_USD in config.ts only if the key limit allows it.');
  process.exit(1);
});
