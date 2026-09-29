import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { dayKey, dueOrder, isDue } from '@/lib/progress';
import { ReviewState, Reminder, Settings, WordEntry } from '@/lib/types';
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
const PLAN_KEY = 'reminderPlan';

// The randomized minute-of-day for each date, kept so reopening the app does
// not re-roll times that are already scheduled.
type Plan = { base: string; minutes: Record<string, number> };

// Asks for permission the first time; returns false if the user said no.
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function loadPlan(reminder: Reminder): Promise<Plan> {
  const base = `${reminder.hour}:${reminder.minute}`;
  try {
    const raw = await AsyncStorage.getItem(PLAN_KEY);
    const plan = raw ? (JSON.parse(raw) as Plan) : null;
    if (plan?.base === base) return plan;
  } catch {}
  // New time picked: today fires exactly at that time, later days are randomized.
  return { base, minutes: { [dayKey()]: reminder.hour * 60 + reminder.minute } };
}

function jittered(reminder: Reminder) {
  const exact = reminder.hour * 60 + reminder.minute;
  const offset = Math.round((Math.random() * 2 - 1) * JITTER_MIN);
  return Math.min(Math.max(exact + offset, 0), 23 * 60 + 59);
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

// Local notifications only. Replaces all scheduled reminders with one per day
// for the next week, each quizzing a different word at a slightly random time.
// Calls are queued so two reschedules never interleave.
export function scheduleReminders(...args: Parameters<typeof schedule>) {
  queue = queue.then(() => schedule(...args)).catch(() => {});
  return queue;
}

async function schedule(
  settings: Settings,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  seenIds: Set<string>,
  cardsViewed: number
) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { reminder } = settings;
  if (!reminder.enabled) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  const plan = await loadPlan(reminder);
  const words = pickWords(settings, savedIds, reviews, seenIds, cardsViewed);
  const minutes: Record<string, number> = {};
  const now = Date.now();
  let wordIndex = 0;

  for (let i = 0; i < DAYS_AHEAD; i++) {
    const day = new Date();
    day.setDate(day.getDate() + i);
    const key = dayKey(day);
    minutes[key] = plan.minutes[key] ?? jittered(reminder);
    day.setHours(Math.floor(minutes[key] / 60), minutes[key] % 60, 0, 0);
    if (day.getTime() <= now) continue;

    const pick = words.length ? words[wordIndex++ % words.length] : null;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Termin',
        body: !pick
          ? 'New words are waiting for you. A few minutes keeps them in your head.'
          : pick.saved
            ? `Do you remember what “${pick.word.word}” means?`
            : `New word: “${pick.word.word}”. Do you know what it means?`,
        data: { url: '/' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: day },
    });
  }
  await AsyncStorage.setItem(PLAN_KEY, JSON.stringify({ base: plan.base, minutes }));
}
