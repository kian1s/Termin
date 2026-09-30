import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { aiWordOrder, candidates, fallbackLine, HORIZON_MS, loadAiPlan, placeAiSlots } from '@/lib/ai-reminders';
import { currentStreak, dayKey, dueOrder, isDue } from '@/lib/progress';
import { Reminder, ReminderTime, ReviewState, Settings, Stats, WordEntry } from '@/lib/types';
import { wordById, wordsFor } from '@/lib/words';

// Show the reminder as a banner even if the app is open when it fires.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const DAYS_AHEAD = 7;
const JITTER_MIN = 30;
const STREAK_SAVER_MINUTE = 21 * 60;
const PLAN_KEY = 'reminderPlan';

// The randomized minute of each reminder slot ("date|time index"), kept so
// reopening the app does not re-roll times that are already scheduled.
type Plan = { base: string; minutes: Record<string, number> };

// Asks for permission the first time; returns false if the user said no.
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const minuteOf = (t: ReminderTime) => t.hour * 60 + t.minute;

export function formatTime(t: ReminderTime) {
  return `${t.hour}:${String(t.minute).padStart(2, '0')}`;
}

async function loadPlan(reminder: Reminder): Promise<Plan> {
  const base = JSON.stringify({ times: reminder.times, vary: reminder.vary });
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    const plan = raw ? (JSON.parse(raw) as Plan) : null;
    if (plan?.base === base) return plan;
  } catch {}
  // New times picked: today fires exactly at those times, later days vary.
  const minutes: Record<string, number> = {};
  reminder.times.forEach((t, i) => (minutes[`${dayKey()}|${i}`] = minuteOf(t)));
  return { base, minutes };
}

function jittered(t: ReminderTime) {
  const offset = Math.round((Math.random() * 2 - 1) * JITTER_MIN);
  return Math.min(Math.max(minuteOf(t) + offset, 0), 23 * 60 + 59);
}

// Words to quiz, best first: due saved words, other saved words, then unseen feed words.
function pickWords(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  seenIds: Set<string>,
  cardsViewed: number
): { word: WordEntry; saved: boolean }[] {
  const saved = [...savedIds]
    .map((id) => wordById(id))
    .filter((w): w is WordEntry => !!w && w.lang === settings.learningLang)
    .sort((a, b) => {
      const ra = reviews[a.id];
      const rb = reviews[b.id];
      const dueA = ra && isDue(ra, cardsViewed) ? 0 : 1;
      const dueB = rb && isDue(rb, cardsViewed) ? 0 : 1;
      if (dueA !== dueB) return dueA - dueB;
      return (ra ? dueOrder(ra) : 0) - (rb ? dueOrder(rb) : 0);
    });
  const fresh = wordsFor(settings)
    .filter((w) => !seenIds.has(w.id) && !savedIds.has(w.id))
    .sort(() => Math.random() - 0.5);
  return [
    ...saved.map((word) => ({ word, saved: true })),
    ...fresh.map((word) => ({ word, saved: false })),
  ];
}

let queue = Promise.resolve();

// Local notifications only (SPEC 4.9, 4.16 and 4.17). Replaces all scheduled
// reminders with the next week's: each chosen weekday, each chosen time, each
// quizzing a different word, plus AI-timed reminders with intelligent spacing.
// Calls are queued so two reschedules never interleave.
export function scheduleReminders(...args: Parameters<typeof schedule>) {
  queue = queue.then(() => schedule(...args)).catch(() => {});
  return queue;
}

type Slot = { key: string; at: Date; time: ReminderTime };

// The user's own reminders for the next week, at the minute each one fires.
function userSlots(reminder: Reminder, plan: Plan, now = Date.now()) {
  const minutes: Record<string, number> = {};
  const slots: Slot[] = [];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date();
    day.setDate(day.getDate() + i);
    if (!reminder.days.includes(day.getDay())) continue;
    for (const [t, time] of reminder.times.entries()) {
      const key = `${dayKey(day)}|${t}`;
      minutes[key] = reminder.vary ? (plan.minutes[key] ?? jittered(time)) : minuteOf(time);
      const at = new Date(day);
      at.setHours(Math.floor(minutes[key] / 60), minutes[key] % 60, 0, 0);
      if (at.getTime() > now) slots.push({ key, at, time });
    }
  }
  return { slots, minutes };
}

// When the user's own reminders fire in the next 48 hours, for the AI planner.
export async function upcomingReminderTimes(settings: Settings): Promise<number[]> {
  const { slots } = userSlots(settings.reminder, await loadPlan(settings.reminder));
  return slots.map((s) => s.at.getTime()).filter((t) => t <= Date.now() + HORIZON_MS);
}

async function schedule(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  seenIds: Set<string>,
  stats: Stats,
  isPremium: boolean
) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { reminder } = settings;
  if (!reminder.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  const now = Date.now();
  const plan = await loadPlan(reminder);
  const { slots, minutes } = userSlots(reminder, plan, now);

  // Streak saver: tonight at 21:00, only while a streak of 2 or more is at
  // risk. Once today counts (SPEC 4.8) the app reschedules without it.
  const streak = currentStreak(stats);
  const saverAt = new Date();
  saverAt.setHours(Math.floor(STREAK_SAVER_MINUTE / 60), STREAK_SAVER_MINUTE % 60, 0, 0);
  const saver =
    reminder.streakSaver &&
    streak >= 2 &&
    stats.lastActive !== dayKey() &&
    reminder.days.includes(new Date().getDay()) &&
    saverAt.getTime() > now;

  // AI reminders (SPEC 4.17, Premium): the AI's word order and lines for the
  // user's reminders and, with intelligent spacing, extra AI-timed ones.
  const ai = isPremium && reminder.aiGuided;
  const aiPlan = ai ? await loadAiPlan(settings) : null;
  const local = ai ? candidates(settings, savedIds, reviews, now) : [];
  const aiSlots =
    ai && reminder.smartSpacing
      ? placeAiSlots(
          aiPlan,
          local,
          [...slots.map((s) => s.at.getTime()), ...(saver ? [saverAt.getTime()] : [])],
          reminder.days,
          now
        )
      : [];
  const usedOnDay = new Set(aiSlots.map((s) => `${s.word.id}|${dayKey(new Date(s.at))}`));

  const notify = (date: Date, body: string, wordId?: string) =>
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'Termin',
        body,
        // AI reminders open the quick test; all others open the feed.
        data: wordId ? { url: '/quick-test', wordId } : { url: '/' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  const aiLine = (word: WordEntry) => aiPlan?.lines[word.id] ?? fallbackLine(word);

  for (const { word, at } of aiSlots) await notify(new Date(at), aiLine(word), word.id);

  let words: { word: WordEntry; saved: boolean }[] = [];
  if (ai) {
    const first = aiWordOrder(aiPlan, local).map((word) => ({ word, saved: true }));
    const ids = new Set(first.map((p) => p.word.id));
    words = [...first, ...pickWords(settings, savedIds, reviews, seenIds, stats.cardsViewed).filter((p) => !ids.has(p.word.id))];
  } else if (reminder.includeWord) {
    words = pickWords(settings, savedIds, reviews, seenIds, stats.cardsViewed);
  }

  let wordIndex = 0;
  for (const { key, at } of slots) {
    // Words do not repeat across all scheduled reminders while enough exist,
    // and never twice on one day.
    const day = key.split('|')[0];
    while (wordIndex < words.length && usedOnDay.has(`${words[wordIndex].word.id}|${day}`)) wordIndex++;
    const pick = wordIndex < words.length ? words[wordIndex++] : null;
    if (pick) usedOnDay.add(`${pick.word.id}|${day}`);
    if (ai && pick?.saved) {
      await notify(at, aiLine(pick.word), pick.word.id);
      continue;
    }
    await notify(
      at,
      !pick
        ? 'A few new words are waiting for you.'
        : pick.saved
          ? `Do you remember what “${pick.word.word}” means?`
          : `New word: “${pick.word.word}”. Do you know what it means?`
    );
  }

  if (saver) await notify(saverAt, `Keep your ${streak}-day streak. One card is enough.`);
  if (devTest && devTest.at.getTime() > Date.now()) await notify(devTest.at, devTest.body, devTest.wordId);

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify({ base: plan.base, minutes }));
}

// Development only: an AI reminder for the most needed saved word in one
// minute, to test the tap and the quick test. Kept across reschedules.
let devTest: { at: Date; body: string; wordId: string } | null = null;

export async function devTestAiReminder(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>
): Promise<string> {
  const top = candidates(settings, savedIds, reviews)[0];
  if (!top) return 'Save a word in the learning language first.';
  const plan = await loadAiPlan(settings);
  const at = new Date(Date.now() + 60_000);
  devTest = { at, body: plan?.lines[top.word.id] ?? fallbackLine(top.word), wordId: top.word.id };
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Termin', body: devTest.body, data: { url: '/quick-test', wordId: top.word.id } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
  return `In 1 minute: ${devTest.body}${plan ? '' : ' (fallback text: no AI plan yet)'}`;
}

// Development only: a readable list of what is scheduled, for testing on the phone.
export async function describeScheduled(): Promise<string> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const lines = all
    .map((n) => {
      const t = n.trigger as { date?: number | string; value?: number } | null;
      const at = new Date(t?.value ?? t?.date ?? 0);
      const ai = (n.content.data as { url?: string } | null)?.url === '/quick-test';
      return { at, text: `${ai ? '[AI] ' : ''}${n.content.body ?? ''}` };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, text }) => `${at.toDateString().slice(0, 10)} ${formatTime({ hour: at.getHours(), minute: at.getMinutes() })}: ${text}`);
  return lines.length ? lines.join('\n\n') : 'Nothing scheduled.';
}
