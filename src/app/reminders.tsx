import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Row, Section, Toggle } from '@/components/grouped-list';
import { PremiumBadge } from '@/components/pro-cards';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { usePremium } from '@/lib/premium';
import { ensureNotificationPermission, formatTime } from '@/lib/reminder';
import { Reminder, ReminderTime } from '@/lib/types';

// Monday first, as weekday chips (JavaScript weekday numbers, 0 = Sunday).
const WEEK = [
  { day: 1, label: 'M' },
  { day: 2, label: 'T' },
  { day: 3, label: 'W' },
  { day: 4, label: 'T' },
  { day: 5, label: 'F' },
  { day: 6, label: 'S' },
  { day: 0, label: 'S' },
];
const MAX_TIMES = 3;
// Suggested times for a second and third reminder.
const EXTRA_TIMES: ReminderTime[] = [
  { hour: 8, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 19, minute: 0 },
];

// SPEC 4.16: all reminder options, all local notifications. The root layout
// reschedules the week whenever these change.
export default function Reminders() {
  const theme = useTheme();
  const { settings, saveSettings } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [androidPicker, setAndroidPicker] = useState<number | null>(null);
  if (!settings) return null;
  const { reminder } = settings;
  const aiOn = isPremium && reminder.aiGuided;
  // Intelligent spacing replaces the user's own times (SPEC 4.17).
  const smart = aiOn && reminder.smartSpacing;

  const update = (next: Partial<Reminder>) => saveSettings({ ...settings, reminder: { ...reminder, ...next } });

  const toggleEnabled = async (on: boolean) => {
    if (on && !(await ensureNotificationPermission())) {
      Alert.alert('Notifications are off', 'Allow notifications for Expo Go in the iPhone Settings to get reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    update({ enabled: on });
  };

  const setTime = (i: number, date?: Date) => {
    setAndroidPicker(null);
    if (!date) return;
    const times = reminder.times.map((t, j) => (j === i ? { hour: date.getHours(), minute: date.getMinutes() } : t));
    update({ times });
  };

  const addTime = () => {
    const used = new Set(reminder.times.map(formatTime));
    const next = EXTRA_TIMES.find((t) => !used.has(formatTime(t))) ?? { hour: 12, minute: 0 };
    update({ times: [...reminder.times, next] });
  };

  const removeTime = (i: number) => update({ times: reminder.times.filter((_, j) => j !== i) });

  const toggleDay = (day: number) => {
    const on = reminder.days.includes(day);
    // Keep at least one day; turning reminders off is what the main switch is for.
    if (on && reminder.days.length === 1) return;
    update({ days: on ? reminder.days.filter((d) => d !== day) : [...reminder.days, day] });
  };

  const asDate = (t: ReminderTime) => {
    const d = new Date();
    d.setHours(t.hour, t.minute, 0, 0);
    return d;
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <Section footer="Local reminders from Termin, each with a word to test yourself on.">
        <Row
          label="Reminders"
          last
          right={<Toggle value={reminder.enabled} onValueChange={toggleEnabled} />}
        />
      </Section>

      {reminder.enabled && (
        <>
          {!smart && (
          <Section title="Times" footer={`Up to ${MAX_TIMES} reminders a day.`}>
            {reminder.times.map((t, i) => (
              <Row
                key={i}
                label={reminder.times.length > 1 ? `Reminder ${i + 1}` : 'Time'}
                onPress={Platform.OS === 'android' ? () => setAndroidPicker(i) : undefined}
                value={Platform.OS === 'android' ? formatTime(t) : undefined}
                chevron={false}
                last={i === reminder.times.length - 1 && reminder.times.length >= MAX_TIMES}
                right={
                  <View style={styles.timeRight}>
                    {Platform.OS === 'ios' && (
                      <DateTimePicker
                        mode="time"
                        display="compact"
                        value={asDate(t)}
                        accentColor={theme.accent}
                        themeVariant={theme.scheme}
                        onValueChange={(_, date) => setTime(i, date)}
                      />
                    )}
                    {reminder.times.length > 1 && (
                      <Pressable onPress={() => removeTime(i)} hitSlop={10} accessibilityLabel={`Remove reminder ${i + 1}`}>
                        <Ionicons name="remove-circle-outline" size={22} color={theme.wrong} />
                      </Pressable>
                    )}
                  </View>
                }
              />
            ))}
            {reminder.times.length < MAX_TIMES && (
              <Row
                label="Add a time"
                icon={<Ionicons name="add" size={22} color={theme.accent} />}
                onPress={addTime}
                chevron={false}
                last
              />
            )}
          </Section>
          )}

          <Section title="Days" footer="No reminders on days that are off.">
            <View style={styles.days}>
              {WEEK.map(({ day, label }) => {
                const on = reminder.days.includes(day);
                return (
                  <Pressable
                    key={day}
                    onPress={() => toggleDay(day)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[
                      styles.day,
                      {
                        backgroundColor: on ? theme.accentSoft : theme.background,
                        borderColor: on ? theme.accent : theme.border,
                      },
                    ]}>
                    <Text style={[styles.dayText, { color: on ? theme.text : theme.textSecondary }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section
            title="AI reminders"
            footer="The AI picks the saved words you most need to practice, and tapping a reminder opens a 1-minute test.">
            <Row
              label="AI reminders"
              onPress={isPremium ? undefined : showPaywall}
              chevron={false}
              last={!aiOn}
              right={
                isPremium ? (
                  <Toggle value={reminder.aiGuided} onValueChange={(v) => update({ aiGuided: v })} />
                ) : (
                  <PremiumBadge lock />
                )
              }
            />
            {aiOn && (
              <Row
                label="Intelligent spacing"
                last
                right={<Toggle value={reminder.smartSpacing} onValueChange={(v) => update({ smartSpacing: v })} />}
              />
            )}
          </Section>

          <Section
            title="Options"
            footer="The streak saver sends one more nudge at 21:00 when a streak of 2 days or more is at risk, and disappears once today counts.">
            {!aiOn && (
              <Row
                label="Include a word"
                subtitle={reminder.includeWord ? 'A word to test yourself on' : 'A plain nudge'}
                right={<Toggle value={reminder.includeWord} onValueChange={(v) => update({ includeWord: v })} />}
              />
            )}
            {!smart && (
            <Row
              label="Vary the time slightly"
              subtitle={reminder.vary ? 'Within 30 minutes of each time' : 'Exactly on time'}
              right={<Toggle value={reminder.vary} onValueChange={(v) => update({ vary: v })} />}
            />
            )}
            <Row
              label="Streak saver"
              last
              right={<Toggle value={reminder.streakSaver} onValueChange={(v) => update({ streakSaver: v })} />}
            />
          </Section>
        </>
      )}

      {androidPicker !== null && (
        <DateTimePicker
          mode="time"
          value={asDate(reminder.times[androidPicker])}
          onValueChange={(_, date) => setTime(androidPicker, date)}
          onDismiss={() => setAndroidPicker(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  timeRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  days: { flexDirection: 'row', justifyContent: 'space-between', padding: Spacing.md },
  day: {
    width: 38,
    height: 38,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 15, fontWeight: '600' },
});
