import { ReviewState, Stats } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

// Leitner scheduling (SPEC 4.4): box 1 after 5 more cards, box 2/3/4 after 1/3/7 days.
const BOX1_CARDS = 5;
const BOX_DAYS = { 2: 1, 3: 3, 4: 7 } as const;

export function newReviewState(cardsViewed: number): ReviewState {
  return { box: 1, dueAtCard: cardsViewed + BOX1_CARDS, dueAt: 0 };
}

export function answerReview(state: ReviewState, correct: boolean, cardsViewed: number): ReviewState {
  if (!correct) return newReviewState(cardsViewed);
  const box = Math.min(state.box + 1, 4) as 2 | 3 | 4;
  return { box, dueAtCard: 0, dueAt: Date.now() + BOX_DAYS[box] * DAY_MS };
}

export function isDue(state: ReviewState, cardsViewed: number, now = Date.now()) {
  return state.box === 1 ? cardsViewed >= state.dueAtCard : now >= state.dueAt;
}

// How overdue a word is, so the most overdue comes first. Box 1 words sort first.
export function dueOrder(state: ReviewState) {
  return state.box === 1 ? state.dueAtCard - 1e15 : state.dueAt;
}

// What each Leitner box is called for the learner (box 1 to 4).
export const STAGES = ['New', 'Learning', 'Familiar', 'Learned'] as const;

export function describeNext(state: ReviewState) {
  if (state.box === 1) return 'It will come back in a few cards.';
  const days = BOX_DAYS[state.box];
  return `${STAGES[state.box - 1]} · next review in ${days} ${days === 1 ? 'day' : 'days'}.`;
}

// Local calendar date, e.g. "2026-09-28".
export function dayKey(date = new Date()) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dayKey(d);
}

export const EMPTY_STATS: Stats = {
  cardsViewed: 0,
  day: dayKey(),
  viewsToday: 0,
  reviewsToday: 0,
  streak: 0,
  best: 0,
  lastActive: null,
};

// Resets the "today" counters when the date has changed since they were written.
export function forToday(stats: Stats): Stats {
  const today = dayKey();
  return stats.day === today ? stats : { ...stats, day: today, viewsToday: 0, reviewsToday: 0 };
}

// SPEC 4.8: a day counts once the user answers a review or views 10 cards.
export function withActivity(stats: Stats): Stats {
  const today = dayKey();
  const active = stats.reviewsToday >= 1 || stats.viewsToday >= 10;
  if (!active || stats.lastActive === today) return stats;
  const streak = stats.lastActive === yesterdayKey() ? stats.streak + 1 : 1;
  const activeDays = [...(stats.activeDays ?? []), today].slice(-14);
  return { ...stats, streak, best: Math.max(stats.best, streak), lastActive: today, activeDays };
}

// Whether a local date counted toward the streak. Older installs have no
// activeDays yet, so the current streak's run of days is used as a fallback.
export function wasActive(stats: Stats, date: Date) {
  const key = dayKey(date);
  if (stats.activeDays?.includes(key)) return true;
  if (!stats.lastActive || stats.streak <= 0) return false;
  const [y, m, d] = stats.lastActive.split('-').map(Number);
  const last = new Date(y, m - 1, d);
  const daysBack = Math.round((last.getTime() - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86_400_000);
  return daysBack >= 0 && daysBack < stats.streak;
}

// The streak shown to the user: it drops to 0 once a full day was missed.
export function currentStreak(stats: Stats) {
  return stats.lastActive === dayKey() || stats.lastActive === yesterdayKey() ? stats.streak : 0;
}
