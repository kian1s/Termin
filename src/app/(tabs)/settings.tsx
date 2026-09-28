import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { ReactNode, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { Field } from '@/lib/questions';
import { applyReminder, ensureNotificationPermission } from '@/lib/reminder';
import { CATEGORY_NAMES, LANG_NAMES, Reminder } from '@/lib/types';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, saveSettings } = useAppState();
  const [showAndroidPicker, setShowAndroidPicker] = useState(false);
  if (!settings) return null;

  const { reminder } = settings;
  const reminderTime = new Date();
  reminderTime.setHours(reminder.hour, reminder.minute, 0, 0);

  const updateReminder = async (next: Reminder) => {
    saveSettings({ ...settings, reminder: next });
    try {
      await applyReminder(next);
    } catch {
      Alert.alert('Could not schedule the reminder', 'Please try again.');
    }
  };

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

      <Section title="Learning">
        <Row label="Learning language" value={LANG_NAMES[settings.learningLang]} onPress={() => edit('learningLang')} />
        <Row label="Native language" value={LANG_NAMES[settings.nativeLang]} onPress={() => edit('nativeLang')} />
        <Row label="Level" value={settings.level} onPress={() => edit('level')} />
        <Row
          label="Categories"
          value={settings.categories.map((c) => CATEGORY_NAMES[c]).join(', ')}
          onPress={() => edit('categories')}
          last
        />
      </Section>

      <Section title="Daily reminder" footer="A gentle nudge once a day to keep your words fresh.">
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

function Section({ title, footer, children }: { title: string; footer?: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[Type.label, styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.group, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {children}
      </View>
      {footer && <Text style={[styles.footer, { color: theme.textSecondary }]}>{footer}</Text>}
    </View>
  );
}

type RowProps = {
  label: string;
  value?: string;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
};

function Row({ label, value, right, onPress, last }: RowProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
        pressed && { backgroundColor: theme.accentSoft },
      ]}>
      <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value && (
          <Text style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {right}
        {onPress && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  title: { fontFamily: Fonts.title, fontSize: 28, paddingHorizontal: Spacing.xs },
  section: { gap: Spacing.sm },
  sectionTitle: { paddingHorizontal: Spacing.lg },
  group: { borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  footer: { fontSize: 13, lineHeight: 18, paddingHorizontal: Spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  rowLabel: { fontSize: 17 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexShrink: 1 },
  rowValue: { fontSize: 17, flexShrink: 1 },
});
