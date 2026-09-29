import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

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

// Local notifications only (SPEC 4.9 and 4.16). Replaces all scheduled
// reminders with the next week's: each chosen weekday, each chosen time, each
// quizzing a different word. Calls are queued so two reschedules never interleave.
export function scheduleReminders(...args: Parameters<typeof schedule>) {
  queue = queue.then(() => schedule(...args)).catch(() => {});
  return queue;
}

async function schedule(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  seenIds: Set<string>,
  stats: Stats
) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { reminder } = settings;
  if (!reminder.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  const plan = await loadPlan(reminder);
  const words = reminder.includeWord ? pickWords(settings, savedIds, reviews, seenIds, stats.cardsViewed) : [];
  const minutes: Record<string, number> = {};
  const now = Date.now();
  let wordIndex = 0;

  const notify = (date: Date, body: string) =>
    Notifications.scheduleNotificationAsync({
      content: { title: 'Termin', body, data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date();
    day.setDate(day.getDate() + i);
    if (!reminder.days.includes(day.getDay())) continue;

    for (const [t, time] of reminder.times.entries()) {
      const key = `${dayKey(day)}|${t}`;
      minutes[key] = reminder.vary ? (plan.minutes[key] ?? jittered(time)) : minuteOf(time);
      const at = new Date(day);
      at.setHours(Math.floor(minutes[key] / 60), minutes[key] % 60, 0, 0);
      if (at.getTime() <= now) continue;

      // Words do not repeat across all scheduled reminders while enough exist.
      const pick = wordIndex < words.length ? words[wordIndex++] : null;
      await notify(
        at,
        !pick
          ? 'A few new words are waiting for you.'
          : pick.saved
            ? `Do you remember what “${pick.word.word}” means?`
            : `New word: “${pick.word.word}”. Do you know what it means?`
      );
    }
  }

  // Streak saver: tonight at 21:00, only while a streak of 2 or more is at
  // risk. Once today counts (SPEC 4.8) the app reschedules without it.
  const streak = currentStreak(stats);
  const today = new Date();
  const saverAt = new Date();
  saverAt.setHours(Math.floor(STREAK_SAVER_MINUTE / 60), STREAK_SAVER_MINUTE % 60, 0, 0);
  if (
    reminder.streakSaver &&
    streak >= 2 &&
    stats.lastActive !== dayKey() &&
    reminder.days.includes(today.getDay()) &&
    saverAt.getTime() > now
  ) {
    await notify(saverAt, `Keep your ${streak}-day streak. One card is enough.`);
  }

  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify({ base: plan.base, minutes }));
}

// Development only: a readable list of what is scheduled, for testing on the phone.
export async function describeScheduled(): Promise<string> {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const lines = all
    .map((n) => {
      const t = n.trigger as { date?: number | string; value?: number } | null;
      const at = new Date(t?.value ?? t?.date ?? 0);
      return { at, text: n.content.body ?? '' };
    })
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(({ at, text }) => `${at.toDateString().slice(0, 10)} ${formatTime({ hour: at.getHours(), minute: at.getMinutes() })}: ${text}`);
  return lines.length ? lines.join('\n\n') : 'Nothing scheduled.';
}
