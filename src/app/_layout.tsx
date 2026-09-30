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
import { refreshAiPlan } from '@/lib/ai-reminders';
import { PremiumProvider, usePremium } from '@/lib/premium';
import { scheduleReminders, upcomingReminderTimes } from '@/lib/reminder';

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
        <Stack.Screen name="level-test" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="reminders" options={{ headerShown: true, title: 'Reminders', headerBackTitle: 'Settings' }} />
        <Stack.Screen name="history" options={{ headerShown: true, title: 'History', headerBackTitle: 'Feed' }} />
        <Stack.Screen
          name="say-it-better"
          options={{ headerShown: true, title: 'Say it better', headerBackTitle: 'Practice' }}
        />
        <Stack.Screen name="snap" options={{ headerShown: true, title: 'Snap a word', headerBackTitle: 'Back' }} />
        <Stack.Screen name="quick-test" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
      <NotificationTaps />
    </>
  );
}

// Keeps the week of smart reminders (SPEC 4.9, 4.16, 4.17) up to date: on
// launch, when the reminder settings change, and when the app goes to the
// background. With AI reminders on, a fresh AI plan is fetched when the app
// opens (at most every 2 hours), since Expo Go cannot run code in the background.
function ReminderSync() {
  const { loaded, settings, savedIds, reviews, seenIds, stats } = useAppState();
  const { isPremium } = usePremium();
  const latest = useRef({ settings, savedIds, reviews, seenIds, stats, isPremium });
  useEffect(() => {
    latest.current = { settings, savedIds, reviews, seenIds, stats, isPremium };
  });

  // Reschedule when the reminder options or learning language change, and when
  // today starts counting toward the streak (which removes the streak saver).
  const reminderKey = settings
    ? `${JSON.stringify(settings.reminder)}|${settings.learningLang}|${stats.lastActive}|${stats.streak}|${isPremium}`
    : '';

  useEffect(() => {
    const sync = () => {
      const l = latest.current;
      if (l.settings) scheduleReminders(l.settings, l.savedIds, l.reviews, l.seenIds, l.stats, l.isPremium);
    };
    const refreshAi = async () => {
      const l = latest.current;
      if (!l.settings) return;
      const fixed = await upcomingReminderTimes(l.settings);
      if (await refreshAiPlan(l.settings, l.savedIds, l.reviews, fixed, l.isPremium)) sync();
    };
    if (loaded) {
      sync();
      refreshAi();
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') sync();
      if (state === 'active') refreshAi();
    });
    return () => sub.remove();
  }, [loaded, reminderKey]);

  return null;
}

// Tapping a reminder: AI reminders open the quick test for their word
// (SPEC 4.17), all others the feed. Rendered inside the navigator, so a tap
// that launched the app is handled once the screens exist.
function NotificationTaps() {
  useEffect(() => {
    const open = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      Notifications.clearLastNotificationResponse();
      const data = response.notification.request.content.data as { url?: string; wordId?: string } | undefined;
      if (data?.url === '/quick-test' && typeof data.wordId === 'string') {
        router.push({ pathname: '/quick-test', params: { word: data.wordId } });
      } else {
        router.navigate('/');
      }
    };
    open(Notifications.getLastNotificationResponse());
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
  return null;
}
