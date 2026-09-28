// OpenRouter client with spend tracking. Every call adds its cost to
// data/pipeline/spend.json, and no call starts once STOP_AT_USD is reached.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PIPELINE_DIR, ROOT, STOP_AT_USD } from './config.ts';

const API = 'https://openrouter.ai/api/v1';
const SPEND_FILE = new URL('spend.json', PIPELINE_DIR);

type Spend = { total: number; byModel: Record<string, number> };

export class SpendLimitError extends Error {}

let spend: Spend | null = null;
let prices: Record<string, { prompt: number; completion: number }> | null = null;

function apiKey(): string {
  if (!process.env.OPENROUTER_API_KEY) {
    try {
      process.loadEnvFile(new URL('.env', ROOT));
    } catch {
      // Reported below.
    }
  }
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY is missing. Add it to .env in the project root.');
  return key;
}

export function readSpend(): Spend {
  if (!spend) {
    spend = existsSync(SPEND_FILE)
      ? JSON.parse(readFileSync(SPEND_FILE, 'utf8'))
      : { total: 0, byModel: {} };
  }
  return spend!;
}

function addSpend(model: string, usd: number) {
  const s = readSpend();
  s.total += usd;
  s.byModel[model] = (s.byModel[model] ?? 0) + usd;
  mkdirSync(PIPELINE_DIR, { recursive: true });
  writeFileSync(SPEND_FILE, JSON.stringify(s, null, 2));
}

// Fallback when a response has no usage.cost: price the tokens ourselves.
async function priceOf(model: string, usage: { prompt_tokens?: number; completion_tokens?: number }) {
  if (!prices) {
    const res = await fetch(`${API}/models`);
    const { data } = (await res.json()) as {
      data: { id: string; pricing: { prompt: string; completion: string } }[];
    };
    prices = Object.fromEntries(
      data.map((m) => [m.id, { prompt: +m.pricing.prompt, completion: +m.pricing.completion }])
    );
  }
  const p = prices[model] ?? { prompt: 0, completion: 0 };
  return (usage.prompt_tokens ?? 0) * p.prompt + (usage.completion_tokens ?? 0) * p.completion;
}

export async function keyInfo() {
  const res = await fetch(`${API}/key`, { headers: { Authorization: `Bearer ${apiKey()}` } });
  return ((await res.json()) as { data: { usage: number; limit: number | null } }).data;
}

type Message = { role: 'system' | 'user'; content: string };

export async function chat(model: string, messages: Message[], temperature = 0.7): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    if (readSpend().total >= STOP_AT_USD) {
      throw new SpendLimitError(`Tracked spend reached $${STOP_AT_USD}. Stopping.`);
    }
    let retry = '';
    try {
      const res = await fetch(`${API}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          'Content-Type': 'application/json',
          'X-Title': 'Wordloop dataset',
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens: 16000, usage: { include: true } }),
        signal: AbortSignal.timeout(300_000),
      });
      const body = (await res.json()) as {
        error?: { message: string };
        choices?: { message: { content: string | null } }[];
        usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number };
      };
      if (body.usage) addSpend(model, body.usage.cost ?? (await priceOf(model, body.usage)));
      const content = body.choices?.[0]?.message?.content;
      if (res.ok && content) return content;
      // Bad key (401), no credit left (402) or the key's $10 limit reached (403):
      // retrying cannot help, so stop the whole run. Saved progress is kept.
      if (res.status === 401 || res.status === 402 || res.status === 403) {
        throw new Error(`OpenRouter ${res.status}: ${body.error?.message ?? 'no credit or bad key'}`);
      }
      retry = `${res.status} ${body.error?.message ?? 'empty response'}`;
    } catch (e) {
      if (e instanceof Error && /^OpenRouter 40[123]/.test(e.message)) throw e;
      retry = String(e);
    }
    // Providers rate-limit bursts (429), so wait longer each time, with jitter.
    if (attempt >= 6) throw new Error(`${model} failed after ${attempt} attempts: ${retry}`);
    console.warn(`  ${model}: ${retry}. Retrying…`);
    await new Promise((r) => setTimeout(r, 10_000 * attempt + Math.random() * 5000));
  }
}

// Parses the first JSON object in a reply, tolerating code fences and chatter.
export function parseJSON<T>(text: string): T {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('No JSON object in reply');
  return JSON.parse(text.slice(start, end + 1)) as T;
}

export async function chatJSON<T>(model: string, messages: Message[], temperature?: number): Promise<T> {
  const text = await chat(model, messages, temperature);
  try {
    return parseJSON<T>(text);
  } catch (e) {
    console.warn(`  ${model}: bad JSON (${e instanceof Error ? e.message : e}). Asking again…`);
    return parseJSON<T>(await chat(model, messages, temperature));
  }
}
