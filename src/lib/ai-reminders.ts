import AsyncStorage from '@react-native-async-storage/async-storage';

import { getDeviceId } from '@/lib/coach';
import { dayKey } from '@/lib/progress';
import { ReviewState, Settings, WordEntry } from '@/lib/types';
import { wordById } from '@/lib/words';

// SPEC 4.17: AI reminders. The Worker orders the saved words that most need
// practice, writes a line for each and, with intelligent spacing, suggests
// times. Everything here that decides what is actually scheduled runs on the
// phone, so the model can never break the rules.

const COACH_URL = process.env.EXPO_PUBLIC_COACH_URL?.replace(/\/$/, '');
const PLAN_KEY = 'aiReminderPlan';
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const REFRESH_MS = 2 * HOUR_MS;
const MAX_CANDIDATES = 8;

export const HORIZON_MS = 48 * HOUR_MS;
export const GAP_MS = 2 * HOUR_MS;
export const WINDOW = { start: 9 * 60, end: 21 * 60 }; // local minutes of the day
export const MAX_AI_PER_DAY = 3;

export type AiPlan = {
  createdAt: number;
  key: string; // the settings the plan was made for
  order: string[];
  lines: Record<string, string>;
  slots: { id: string; at: number }[];
};

export type Candidate = { word: WordEntry; review: ReviewState; dueAt: number; score: number };

// When a saved word falls due. Box 1 comes back after a few feed cards, so it counts as due now.
function dueTime(review: ReviewState, now: number) {
  return review.box === 1 ? now : review.dueAt;
}

// Saved words in the learning language, most in need of practice first:
// days overdue + 2 × misses + (4 − box). Only words due within the next 48 hours.
export function candidates(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  now = Date.now()
): Candidate[] {
  return [...savedIds]
    .map((id) => ({ word: wordById(id), review: reviews[id] }))
    .filter((c): c is { word: WordEntry; review: ReviewState } => !!c.word && !!c.review && c.word.lang === settings.learningLang)
    .map(({ word, review }) => {
      const dueAt = dueTime(review, now);
      const overdueDays = Math.max(0, (now - dueAt) / DAY_MS);
      return { word, review, dueAt, score: overdueDays + 2 * (review.misses ?? 0) + (4 - review.box) };
    })
    .filter((c) => c.dueAt <= now + HORIZON_MS)
    .sort((a, b) => b.score - a.score || a.dueAt - b.dueAt);
}

export function fallbackLine(word: WordEntry) {
  return `Do you remember what “${word.word}” means? Tap for a 1-minute test.`;
}

// Local time as "YYYY-MM-DD HH:MM", the format the Worker reads and writes.
function formatLocal(ms: number) {
  const d = new Date(ms);
  return `${dayKey(d)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseLocal(text: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  const at = new Date(y, mo - 1, d, h, mi).getTime();
  return Number.isNaN(at) ? null : at;
}

export function planKey(settings: Settings) {
  const { times, days, vary, smartSpacing } = settings.reminder;
  return JSON.stringify({ lang: settings.learningLang, times, days, vary, smartSpacing });
}

export async function loadAiPlan(settings: Settings): Promise<AiPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    const plan = raw ? (JSON.parse(raw) as AiPlan) : null;
    // A plan for other settings, or older than the 48 hours it covers, is not used.
    if (!plan || plan.key !== planKey(settings) || Date.now() - plan.createdAt > HORIZON_MS) return null;
    return plan;
  } catch {
    return null;
  }
}

// Fetches a new plan when the stored one is missing, stale (2 hours) or made
// for other settings. Returns true when a new plan was stored. Any failure
// leaves the offline fallback in place.
export async function refreshAiPlan(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  fixedTimes: number[],
  isPremium: boolean
): Promise<boolean> {
  if (!COACH_URL || !isPremium || !settings.reminder.enabled || !settings.reminder.aiGuided) return false;
  const current = await loadAiPlan(settings);
  if (current && Date.now() - current.createdAt < REFRESH_MS) return false;

  const now = Date.now();
  const top = candidates(settings, savedIds, reviews, now).slice(0, MAX_CANDIDATES);
  if (!top.length) return false;

  const controller = new AbortController();
  // The model reasons before answering, which can take about 30 seconds.
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${COACH_URL}/plan-reminders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: await getDeviceId(),
        isPro: isPremium,
        learningLang: settings.learningLang,
        now: `${formatLocal(now)} (${new Date(now).toLocaleDateString('en-US', { weekday: 'long' })})`,
        fixedTimes: fixedTimes.map(formatLocal),
        smartSpacing: settings.reminder.smartSpacing,
        candidates: top.map((c) => ({
          id: c.word.id,
          word: c.word.word,
          box: c.review.box,
          due: c.dueAt <= now ? 'now' : formatLocal(c.dueAt),
          misses: c.review.misses ?? 0,
        })),
      }),
      signal: controller.signal,
    });
    if (!res.ok) return false;
    const body = (await res.json()) as {
      order?: string[];
      lines?: Record<string, string>;
      slots?: { id: string; at: string }[];
    };
    if (!Array.isArray(body.order) || !body.order.length) return false;
    const plan: AiPlan = {
      createdAt: now,
      key: planKey(settings),
      order: body.order,
      lines: body.lines ?? {},
      slots: (body.slots ?? [])
        .map((s) => ({ id: s.id, at: parseLocal(s.at) }))
        .filter((s): s is { id: string; at: number } => s.at !== null),
    };
    await AsyncStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Saved words for the user's own reminders: the AI's order first, then the
// local score order for anything the plan does not cover.
export function aiWordOrder(plan: AiPlan | null, local: Candidate[]): WordEntry[] {
  const byId = new Map(local.map((c) => [c.word.id, c.word]));
  const ordered = (plan?.order ?? []).map((id) => byId.get(id)).filter((w): w is WordEntry => !!w);
  return [...ordered, ...local.map((c) => c.word).filter((w) => !ordered.includes(w))];
}

const minuteOfDay = (ms: number) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};

// Intelligent spacing: the AI-timed reminders that pass every rule, given the
// times already taken by the user's reminders and the streak saver. Uses the
// AI's suggestions when there are any, otherwise the word's due time moved
// into the allowed window (the offline fallback).
export function placeAiSlots(
  plan: AiPlan | null,
  local: Candidate[],
  taken: number[],
  days: number[],
  now = Date.now()
): { word: WordEntry; at: number }[] {
  const byId = new Map(local.map((c) => [c.word.id, c]));
  const times = [...taken];
  const perDay = new Map<string, number>();
  const wordDays = new Set<string>();
  const placed: { word: WordEntry; at: number }[] = [];

  const fits = (c: Candidate, at: number) => {
    const day = dayKey(new Date(at));
    const minute = minuteOfDay(at);
    return (
      at > now + 5 * 60 * 1000 &&
      at <= now + HORIZON_MS &&
      minute >= WINDOW.start &&
      minute <= WINDOW.end &&
      days.includes(new Date(at).getDay()) &&
      at >= c.dueAt &&
      (perDay.get(day) ?? 0) < MAX_AI_PER_DAY &&
      !wordDays.has(`${c.word.id}|${day}`) &&
      times.every((t) => Math.abs(t - at) >= GAP_MS)
    );
  };
  const take = (c: Candidate, at: number) => {
    const day = dayKey(new Date(at));
    times.push(at);
    perDay.set(day, (perDay.get(day) ?? 0) + 1);
    wordDays.add(`${c.word.id}|${day}`);
    placed.push({ word: c.word, at });
  };

  const suggested = (plan?.slots ?? []).filter((s) => byId.has(s.id)).sort((a, b) => a.at - b.at);
  if (suggested.length) {
    for (const s of suggested) {
      const c = byId.get(s.id)!;
      if (fits(c, s.at)) take(c, s.at);
    }
    return placed;
  }

  // Fallback: each word at the first allowed half hour at or after it falls due.
  for (const c of local) {
    const start = new Date(Math.max(c.dueAt, now + 15 * 60 * 1000));
    start.setMinutes(start.getMinutes() < 30 ? 30 : 60, 0, 0);
    for (let at = start.getTime(); at <= now + HORIZON_MS; at += 30 * 60 * 1000) {
      if (fits(c, at)) {
        take(c, at);
        break;
      }
    }
  }
  return placed;
}
