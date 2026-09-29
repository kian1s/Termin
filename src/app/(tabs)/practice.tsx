import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { dayKey } from '@/lib/progress';
import { Field, LEVEL_HINTS } from '@/lib/questions';
import { CATEGORY_NAMES, coachFeedbackLang, LANG_NAMES } from '@/lib/types';
import { wordById } from '@/lib/words';

type IconName = keyof typeof Ionicons.glyphMap;

// Practice: learning tools and the learning setup as raised tiles. Layout
// rule: tall tiles always span the full width; only thin tiles sit side by side.
export default function Practice() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, seenAt } = useAppState();
  if (!settings) return null;

  const edit = (field: Field) => router.push({ pathname: '/edit/[field]', params: { field } });

  // History tile: words seen today and the most recent one.
  const today = dayKey();
  const seen = Object.entries(seenAt).sort((a, b) => b[1] - a[1]);
  const seenToday = seen.filter(([, t]) => dayKey(new Date(t)) === today).length;
  const lastWord = seen.length ? wordById(seen[0][0]) : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text }]}>Practice</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your tools and your learning setup.</Text>
      </View>

      <Text style={[Type.label, styles.section, { color: theme.textSecondary }]}>Explore</Text>

      <Tile icon="time-outline" label="History" onPress={() => router.push('/history')} tall>
        <View style={styles.tallBody}>
          <View>
            <Text style={[styles.bigNumber, { color: theme.text }]}>{seenToday}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              {seenToday === 1 ? 'word' : 'words'} today
            </Text>
          </View>
          {lastWord && (
            <View style={styles.lastBlock}>
              <Text style={[styles.detail, { color: theme.textSecondary }]}>Last seen</Text>
              <Text style={[styles.lastWord, { color: theme.word }]} numberOfLines={1}>
                {lastWord.word}
                <Text style={{ color: theme.spark }}>.</Text>
              </Text>
            </View>
          )}
        </View>
      </Tile>

      <Tile icon="speedometer-outline" label="Level test" onPress={() => router.push('/level-test')} tall>
        <View style={styles.tallBody}>
          <View>
            <Text style={[styles.tileTitle, { color: theme.text }]}>Find my level</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>12 questions · about 2 minutes</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </View>
      </Tile>

      <Text style={[Type.label, styles.section, { color: theme.textSecondary }]}>Your learning</Text>

      <View style={styles.row}>
        <Tile icon="language-outline" label="Learning" onPress={() => edit('learningLang')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {LANG_NAMES[settings.learningLang]}
          </Text>
        </Tile>
        <Tile icon="home-outline" label="Native" onPress={() => edit('nativeLang')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {LANG_NAMES[settings.nativeLang]}
          </Text>
        </Tile>
      </View>

      <View style={styles.row}>
        <Tile icon="trending-up-outline" label="Level" onPress={() => edit('level')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            <Text style={{ color: theme.word }}>{settings.level}</Text>
            <Text style={[styles.valueSmall, { color: theme.textSecondary }]}>
              {'  '}
              {LEVEL_HINTS[settings.level].split(' · ')[1]}
            </Text>
          </Text>
        </Tile>
        <Tile icon="pricetags-outline" label="Categories" onPress={() => edit('categories')}>
          <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
            {settings.categories.length === 1
              ? CATEGORY_NAMES[settings.categories[0]]
              : `${settings.categories.length} chosen`}
          </Text>
        </Tile>
      </View>

      <Tile icon="sparkles-outline" label="AI Coach" onPress={() => edit('coachLanguage')}>
        <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
          Answers in {LANG_NAMES[coachFeedbackLang(settings)]}
        </Text>
      </Tile>
    </ScrollView>
  );
}

function Tile({
  icon,
  label,
  onPress,
  tall,
  children,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tall?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const dark = theme.scheme === 'dark';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.tile,
        tall && styles.tall,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          // Raised look: a soft shadow toward the bottom right. Pressing the
          // tile pushes it down, like a physical button.
          shadowColor: theme.shadow,
          shadowOpacity: pressed ? 0.08 : dark ? 0.5 : 0.16,
          shadowOffset: pressed ? { width: 1, height: 1 } : { width: 3, height: 4 },
          transform: [{ translateY: pressed ? 2 : 0 }],
        },
      ]}>
      <View style={styles.tileHead}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name={icon} size={16} color={theme.accent} />
        </View>
        <Text style={[Type.label, { color: theme.textSecondary }]}>{label}</Text>
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.md },
  titleBlock: { paddingHorizontal: Spacing.xs, gap: Spacing.xs, marginBottom: Spacing.sm },
  title: { fontFamily: Fonts.title, fontSize: 28 },
  subtitle: { fontSize: 15 },
  section: { paddingHorizontal: Spacing.xs, marginTop: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  tile: {
    flex: 1,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
    shadowRadius: 6,
    elevation: 3,
  },
  // Tall tiles are full width and only moderately tall.
  tall: { minHeight: 112 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tallBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.lg },
  bigNumber: { fontFamily: Fonts.title, fontSize: 32, lineHeight: 38 },
  tileTitle: { fontFamily: Fonts.title, fontSize: 22, lineHeight: 28 },
  detail: { fontSize: 14 },
  lastBlock: { alignItems: 'flex-end', flexShrink: 1 },
  lastWord: { fontFamily: Fonts.word, fontSize: 20 },
  value: { fontFamily: Fonts.title, fontSize: 19, lineHeight: 24 },
  valueSmall: { fontSize: 14 },
});
