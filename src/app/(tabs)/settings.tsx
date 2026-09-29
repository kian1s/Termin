import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row, Section, Toggle } from '@/components/grouped-list';
import { PremiumBadge } from '@/components/pro-cards';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { Field } from '@/lib/questions';
import { usePremium } from '@/lib/premium';
import { ensureNotificationPermission } from '@/lib/reminder';
import { CATEGORY_NAMES, coachFeedbackLang, LANG_NAMES, Reminder } from '@/lib/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    settings,
    saveSettings,
    devSetLastActive,
    devMakeAllDue,
    devRestartOnboarding,
    devStrongLearner,
    setDevStrongLearner,
  } = useAppState();
  const { isPremium, showPaywall, restore, debugInfo, devOverride, setDevOverride } = usePremium();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  // Developer tools stay hidden (e.g. while filming) until the version row is
  // tapped 5 times in a row. Only possible in development builds.
  const [showDev, setShowDev] = useState(false);
  const versionTaps = useRef({ count: 0, last: 0 });
  const onVersionTap = () => {
    if (!__DEV__) return;
    const now = Date.now();
    const t = versionTaps.current;
    t.count = now - t.last < 1500 ? t.count + 1 : 1;
    t.last = now;
    if (t.count >= 5) {
      t.count = 0;
      setShowDev((on) => !on);
    }
  };
  if (!settings) return null;

  const { reminder } = settings;
  const reminderTime = new Date();
  reminderTime.setHours(reminder.hour, reminder.minute, 0, 0);

  // The root layout reschedules the week of reminders whenever these change.
  const updateReminder = (next: Reminder) => saveSettings({ ...settings, reminder: next });

  const toggleReminder = async (on: boolean) => {
    if (on && !(await ensureNotificationPermission())) {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for this app in the iPhone Settings to get a daily reminder.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }
    updateReminder({ ...reminder, enabled: on });
  };

  const onTimeChange = (date?: Date) => {
    setShowAndroidPicker(false);
    if (date) updateReminder({ ...reminder, hour: date.getHours(), minute: date.getMinutes() });
  };

  const edit = (field: Field) => router.push({ pathname: '/edit/[field]', params: { field } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      <Section
        title="Termin Premium"
        footer={isPremium ? undefined : 'Premium unlocks Idioms, Work, every C1 and C2 word, and unlimited sets.'}>
        <Row
          label={isPremium ? 'Premium is active' : 'Free plan'}
          icon={<Ionicons name={isPremium ? 'star' : 'star-outline'} size={20} color={theme.premium} />}
          right={isPremium ? <PremiumBadge /> : undefined}
          chevron={false}
        />
        {!isPremium && (
          <Row
            label="Upgrade to Premium"
            icon={<Ionicons name="lock-open-outline" size={20} color={theme.premium} />}
            onPress={showPaywall}
          />
        )}
        <Row label="Restore purchases" onPress={restore} chevron={false} last />
      </Section>

      <Section title="Learning">
        <Row label="Learning language" value={LANG_NAMES[settings.learningLang]} onPress={() => edit('learningLang')} />
        <Row label="Native language" value={LANG_NAMES[settings.nativeLang]} onPress={() => edit('nativeLang')} />
        <Row label="Level" value={settings.level} onPress={() => edit('level')} />
        <Row
          label="Categories"
          value={settings.categories.map((c) => CATEGORY_NAMES[c]).join(', ')}
          onPress={() => edit('categories')}
        />
        <Row
          label="AI Coach language"
          value={LANG_NAMES[coachFeedbackLang(settings)]}
          onPress={() => edit('coachLanguage')}
          last
        />
      </Section>

      <Section title="Daily reminder" footer="Once a day, around this time, a word you saved (or a new one) to test yourself on.">
        <Row
          label="Daily reminder"
          last={!reminder.enabled}
          right={
            <Toggle value={reminder.enabled} onValueChange={toggleReminder} />
          }
        />
        {reminder.enabled && (
          <Row
            label="Time"
            last
            onPress={Platform.OS === 'android' ? () => setShowAndroidPicker(true) : undefined}
            value={Platform.OS === 'android' ? formatTime(reminder) : undefined}
            right={
              Platform.OS === 'ios' ? (
                <DateTimePicker
                  mode="time"
                  display="compact"
                  value={reminderTime}
                  accentColor={theme.accent}
                  themeVariant={theme.scheme}
                  onValueChange={(_, date) => onTimeChange(date)}
                />
              ) : undefined
            }
          />
        )}
      </Section>

      <Section title="About">
        <Row
          label="Version"
          value={Constants.expoConfig?.version ?? '1.0.0'}
          onPress={onVersionTap}
          chevron={false}
          last
        />
      </Section>

      {__DEV__ && showDev && (
        <Section title="Developer" footer="For testing only. Tap Version 5 times to hide.">
          <Row label="Last active: yesterday" onPress={() => devSetLastActive(1)} chevron={false} />
          <Row label="Last active: 3 days ago" onPress={() => devSetLastActive(3)} chevron={false} />
          <Row label="Make all saved words due" onPress={devMakeAllDue} chevron={false} />
          <Row
            label="Restart onboarding"
            onPress={() => {
              devRestartOnboarding();
              router.replace('/onboarding');
            }}
            chevron={false}
          />
          <Row
            label="Simulate strong learner"
            right={
              <Toggle value={devStrongLearner} onValueChange={setDevStrongLearner} />
            }
          />
          <Row label="RevenueCat status" onPress={debugInfo} chevron={false} />
          <Row
            label={`Premium override: ${devOverride === null ? 'off' : devOverride ? 'Premium' : 'Free'}`}
            onPress={() => setDevOverride(devOverride === null ? true : devOverride ? false : null)}
            chevron={false}
            last
          />
        </Section>
      )}

      {showAndroidPicker && (
        <DateTimePicker
          mode="time"
          value={reminderTime}
          onValueChange={(_, date) => onTimeChange(date)}
          onDismiss={() => setShowAndroidPicker(false)}
        />
      )}
    </ScrollView>
  );
}

function formatTime({ hour, minute }: Reminder) {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  title: { fontFamily: Fonts.title, fontSize: 28, paddingHorizontal: Spacing.xs },
});
