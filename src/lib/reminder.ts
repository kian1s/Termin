import * as Notifications from 'expo-notifications';

import { Reminder } from '@/lib/types';

// Show the reminder as a banner even if the app is open when it fires.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Asks for permission the first time; returns false if the user said no.
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// Local notifications only. Replaces any previously scheduled reminder.
export async function applyReminder(reminder: Reminder) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!reminder.enabled) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wordloop',
      body: 'New words are waiting for you. A few minutes keeps them in your head.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: reminder.minute,
    },
  });
}
