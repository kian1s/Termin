import {
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
  useFonts,
} from '@expo-google-fonts/fraunces';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { AppStateProvider, useAppState } from '@/lib/app-state';
import { PremiumProvider } from '@/lib/premium';
import { scheduleReminders } from '@/lib/reminder';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppStateProvider>
      <PremiumProvider>
        <RootStack />
        <ReminderSync />
      </PremiumProvider>
    </AppStateProvider>
  );
}

function RootStack() {
  const theme = useTheme();
  const { loaded } = useAppState();
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold, Fraunces_400Regular_Italic });
  const ready = loaded && fontsLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const sheet = {
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    contentStyle: { backgroundColor: theme.background },
  };

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.background },
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.accent,
          headerTitleStyle: { color: theme.text },
          headerShadowVisible: false,
        }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen name="edit/[field]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="set/[id]" options={{ headerShown: true, title: '', headerBackTitle: 'Sets' }} />
        <Stack.Screen name="add-to-set/[wordId]" options={{ ...sheet, sheetAllowedDetents: [0.5, 1] }} />
        <Stack.Screen name="set-name" options={{ ...sheet, sheetAllowedDetents: [0.4] }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
        <Stack.Screen
          name="flashcards/[setId]"
          options={{ headerShown: true, title: 'Flashcards', headerBackTitle: 'Set' }}
        />
        <Stack.Screen name="history" options={{ headerShown: true, title: 'History', headerBackTitle: 'Feed' }} />
      </Stack>
    </>
  );
}

// Keeps the week of smart reminders (SPEC 4.9) up to date: on launch, when the
// reminder settings change, and when the app goes to the background.
function ReminderSync() {
  const { loaded, settings, savedIds, reviews, seenIds, stats } = useAppState();
  const latest = useRef({ settings, savedIds, reviews, seenIds, cardsViewed: stats.cardsViewed });
  useEffect(() => {
    latest.current = { settings, savedIds, reviews, seenIds, cardsViewed: stats.cardsViewed };
  });

  const reminderKey = settings
    ? `${settings.reminder.enabled}|${settings.reminder.hour}|${settings.reminder.minute}|${settings.learningLang}`
    : '';

  useEffect(() => {
    const sync = () => {
      const l = latest.current;
      if (l.settings) scheduleReminders(l.settings, l.savedIds, l.reviews, l.seenIds, l.cardsViewed);
    };
    if (loaded) sync();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') sync();
    });
    return () => sub.remove();
  }, [loaded, reminderKey]);

  // Tapping a reminder opens the feed.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => router.navigate('/'));
    return () => sub.remove();
  }, []);

  return null;
}
