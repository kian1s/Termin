import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row, Section } from '@/components/grouped-list';
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
  const { settings, saveSettings, devSetLastActive, devMakeAllDue, devStrongLearner, setDevStrongLearner } =
    useAppState();
  const { isPremium, showPaywall, restore, debugInfo, devOverride, setDevOverride } = usePremium();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
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
          icon={<Ionicons name={isPremium ? 'star' : 'star-outline'} size={20} color={theme.accent} />}
          chevron={false}
        />
        {!isPremium && (
          <Row
            label="Upgrade to Premium"
            icon={<Ionicons name="lock-open-outline" size={20} color={theme.accent} />}
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
            <Switch
              value={reminder.enabled}
              onValueChange={toggleReminder}
              trackColor={{ true: theme.accent }}
            />
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

      {__DEV__ && (
        <Section title="Developer" footer="Only visible while developing, for testing on the phone.">
          <Row label="Last active: yesterday" onPress={() => devSetLastActive(1)} chevron={false} />
          <Row label="Last active: 3 days ago" onPress={() => devSetLastActive(3)} chevron={false} />
          <Row label="Make all saved words due" onPress={devMakeAllDue} chevron={false} />
          <Row
            label="Simulate strong learner"
            right={
              <Switch value={devStrongLearner} onValueChange={setDevStrongLearner} trackColor={{ true: theme.accent }} />
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
