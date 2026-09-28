// Free script checks (stage 4): fields, headword in example, and the
// Wiktionary originality check.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ARTICLES, LANGS, PIPELINE_DIR, type Lang, type WordEntry } from './config.ts';

export type Flag = {
  id: string;
  severity: 'serious' | 'minor';
  type: string;
  reason: string;
  source: 'script' | 'model';
};

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

// Headword without articles, used to find repeats and match model replies.
export function headKey(lang: Lang, word: string): string {
  const t = tokens(word);
  while (t.length > 1 && ARTICLES[lang].includes(t[0])) t.shift();
  return t.join(' ');
}

// Every field present and no empty string. Returns problems, if any.
export function fieldProblems(e: WordEntry): string[] {
  const out: string[] = [];
  for (const k of ['id', 'lang', 'level', 'category', 'word', 'partOfSpeech', 'definition', 'example'] as const) {
    if (typeof e[k] !== 'string' || !e[k].trim()) out.push(`missing ${k}`);
  }
  for (const l of LANGS.filter((l) => l !== e.lang)) {
    const t = e.translations?.[l];
    if (!t || !t.word?.trim() || !t.definition?.trim()) out.push(`missing ${l} translation`);
  }
  for (const l of Object.keys(e.translations ?? {})) {
    if (l === e.lang || !LANGS.includes(l as Lang)) out.push(`unexpected translation key ${l}`);
  }
  return out;
}

// Loose stem match, because verbs and nouns change form (undermine → undermined).
function stemMatch(a: string, b: string) {
  const n = Math.min(a.length, Math.max(3, Math.ceil(a.length * 0.6)));
  return b.startsWith(a.slice(0, n));
}

export function headwordInExample(e: WordEntry): boolean {
  const head = tokens(e.word).filter((t) => t.length >= 3 && !ARTICLES[e.lang].includes(t));
  if (!head.length) return true;
  const ex = tokens(e.example);
  const found = head.filter((h) => ex.some((x) => stemMatch(h, x))).length;
  return found / head.length >= 0.7;
}

// Script flags for one entry, except the Wiktionary check.
export function scriptFlags(e: WordEntry): { flags: Flag[]; hints: string[] } {
  const flags: Flag[] = [];
  const hints: string[] = [];
  const problems = fieldProblems(e);
  if (problems.length) {
    flags.push({ id: e.id, severity: 'serious', type: 'fields', reason: problems.join(', '), source: 'script' });
  }
  if (e.example && !headwordInExample(e)) {
    hints.push('the headword was not found in the example by exact spelling (it may be an irregular or separable form)');
  }
  const defWords = tokens(e.definition ?? '').length;
  const exWords = tokens(e.example ?? '').length;
  if (defWords > 24) {
    flags.push({ id: e.id, severity: 'minor', type: 'phrasing', reason: `definition is ${defWords} words`, source: 'script' });
  }
  if (exWords && (exWords < 6 || exWords > 26)) {
    flags.push({ id: e.id, severity: 'minor', type: 'example', reason: `example is ${exWords} words`, source: 'script' });
  }
  return { flags, hints };
}

// --- Wiktionary originality check ---

const CACHE_DIR = new URL('wiktionary/', PIPELINE_DIR);
const caches: Partial<Record<Lang, Record<string, string>>> = {};

function cacheFor(lang: Lang) {
  if (!caches[lang]) {
    const file = new URL(`${lang}.json`, CACHE_DIR);
    caches[lang] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  }
  return caches[lang]!;
}

export function saveWiktionaryCache() {
  mkdirSync(CACHE_DIR, { recursive: true });
  for (const [lang, cache] of Object.entries(caches)) {
    writeFileSync(new URL(`${lang}.json`, CACHE_DIR), JSON.stringify(cache));
  }
}

// Wikimedia rate-limits bursts, so every lookup goes through one queue with a
// short gap between requests, and 429 answers wait as long as Retry-After asks.
const USER_AGENT = 'WordloopDataset/1.0 (https://github.com/kian1s/wordloop; vocabulary originality check)';
const GAP_MS = 250;
let queue: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
export const wiktionaryStats = { lookups: 0, unavailable: 0 };

function queued<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(async () => {
    const wait = lastRequest + GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequest = Date.now();
    return task();
  });
  queue = run.catch(() => undefined);
  return run;
}

// The page text, '' if the page does not exist, or null if Wiktionary could not be reached.
async function fetchExtract(lang: Lang, title: string): Promise<string | null> {
  const url = new URL(`https://${lang}.wiktionary.org/w/api.php`);
  url.search = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    redirects: '1',
    format: 'json',
    titles: title,
  }).toString();
  for (let attempt = 1; attempt <= 8; attempt++) {
    let waitMs = 3000 * attempt;
    try {
      const res = await queued(() =>
        fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(30_000) })
      );
      if (res.ok) {
        const body = (await res.json()) as { query?: { pages?: Record<string, { extract?: string }> } };
        return Object.values(body.query?.pages ?? {})[0]?.extract ?? '';
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      if (retryAfter > 0) waitMs = Math.max(waitMs, retryAfter * 1000);
    } catch {
      // Network error: retry below.
    }
    await queued(() => new Promise((r) => setTimeout(r, waitMs)));
  }
  return null;
}

// Wiktionary's text for a headword: the exact title, then without the article,
// then lowercased. Only real answers are cached, so reruns cost nothing and a
// failed lookup is tried again next time. null means the check could not run.
async function wiktionaryText(lang: Lang, word: string): Promise<string | null> {
  const cache = cacheFor(lang);
  if (word in cache) return cache[word];
  wiktionaryStats.lookups++;
  const bare = word.replace(new RegExp(`^(${ARTICLES[lang].join('|')})['’ ]\\s*`, 'i'), '');
  let text = '';
  for (const title of [...new Set([word, bare, bare.toLowerCase()])]) {
    const t = await fetchExtract(lang, title);
    if (t === null) {
      wiktionaryStats.unavailable++;
      return null;
    }
    text = t;
    if (text) break;
  }
  cache[word] = text;
  return text;
}

function bigrams(t: string[]) {
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(`${t[i]} ${t[i + 1]}`);
  return out;
}

// Longest run of consecutive words shared by both texts.
function longestRun(a: string[], b: string[]) {
  let best = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      best = Math.max(best, k);
    }
  }
  return best;
}

// A very close match to any Wiktionary line is a serious flag.
export async function wiktionaryFlag(e: WordEntry): Promise<Flag | null> {
  const def = tokens(e.definition ?? '');
  if (def.length < 4) return null;
  const text = await wiktionaryText(e.lang, e.word);
  if (text === null) return null;
  const defBigrams = bigrams(def);
  for (const line of text.split('\n')) {
    const t = tokens(line);
    if (t.length < 4) continue;
    const lb = bigrams(t);
    const shared = [...defBigrams].filter((b) => lb.has(b)).length;
    const dice = (2 * shared) / (defBigrams.size + lb.size || 1);
    const run = longestRun(def, t);
    if (run >= 7 || (dice >= 0.6 && def.length >= 6)) {
      return {
        id: e.id,
        severity: 'serious',
        type: 'copied',
        reason: `definition is very close to Wiktionary: "${line.trim().slice(0, 160)}"`,
        source: 'script',
      };
    }
  }
  return null;
}
