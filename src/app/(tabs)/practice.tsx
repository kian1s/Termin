import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Pressable, ScrollView, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { dayKey } from '@/lib/progress';
import { Field, LEVEL_HINTS } from '@/lib/questions';
import { CATEGORY_NAMES, coachFeedbackLang, LANG_NAMES } from '@/lib/types';
import { wordById } from '@/lib/words';

type IconName = keyof typeof Ionicons.glyphMap;

// Practice: learning tools and the learning setup, as a grid of tiles in
// different sizes. Tiles open the same screens as before.
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
      <View style={styles.row}>
        <Tile icon="time-outline" label="History" onPress={() => router.push('/history')} style={styles.tall} flex={1.3}>
          <View style={styles.bottom}>
            <Text style={[styles.bigNumber, { color: theme.text }]}>{seenToday}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              {seenToday === 1 ? 'word' : 'words'} today
            </Text>
            {lastWord && (
              <Text style={[styles.lastWord, { color: theme.word }]} numberOfLines={1}>
                {lastWord.word}
                <Text style={{ color: theme.spark }}>.</Text>
              </Text>
            )}
          </View>
        </Tile>
        <Tile
          icon="speedometer-outline"
          label="Level test"
          onPress={() => router.push('/level-test')}
          style={styles.tall}
          flex={1}>
          <View style={styles.bottom}>
            <Text style={[styles.tileTitle, { color: theme.text }]}>Find my level</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>12 questions · 2 min</Text>
          </View>
        </Tile>
      </View>

      <Text style={[Type.label, styles.section, { color: theme.textSecondary }]}>Your learning</Text>
      <View style={styles.row}>
        <Tile icon="language-outline" label="Learning" onPress={() => edit('learningLang')} style={styles.medium}>
          <Text style={[styles.value, { color: theme.text }]}>{LANG_NAMES[settings.learningLang]}</Text>
        </Tile>
        <Tile icon="home-outline" label="Native" onPress={() => edit('nativeLang')} style={styles.medium}>
          <Text style={[styles.value, { color: theme.text }]}>{LANG_NAMES[settings.nativeLang]}</Text>
        </Tile>
      </View>

      <View style={styles.row}>
        <Tile icon="trending-up-outline" label="Level" onPress={() => edit('level')} style={styles.large} flex={0.8}>
          <View style={styles.bottom}>
            <Text style={[styles.level, { color: theme.word }]}>{settings.level}</Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              {LEVEL_HINTS[settings.level].split(' · ')[1]}
            </Text>
          </View>
        </Tile>
        <Tile icon="pricetags-outline" label="Categories" onPress={() => edit('categories')} style={styles.large} flex={1.4}>
          <View style={styles.pills}>
            {settings.categories.map((c) => (
              <View key={c} style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
                <Text style={[styles.pillText, { color: theme.text }]}>{CATEGORY_NAMES[c]}</Text>
              </View>
            ))}
          </View>
        </Tile>
      </View>

      <Tile icon="sparkles-outline" label="" onPress={() => edit('coachLanguage')} style={styles.slim} horizontal>
        <Text style={[styles.slimText, { color: theme.text }]}>
          AI Coach answers in <Text style={styles.slimStrong}>{LANG_NAMES[coachFeedbackLang(settings)]}</Text>
        </Text>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Tile>
    </ScrollView>
  );
}

function Tile({
  icon,
  label,
  onPress,
  style,
  flex = 1,
  horizontal,
  children,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  flex?: number;
  horizontal?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label || undefined}
      style={({ pressed }) => [
        styles.tile,
        horizontal && styles.tileHorizontal,
        { flex, backgroundColor: pressed ? theme.accentSoft : theme.surface, borderColor: theme.border },
        style,
      ]}>
      <View style={styles.tileHead}>
        <View style={[styles.iconCircle, { backgroundColor: theme.accentSoft }]}>
          <Ionicons name={icon} size={18} color={theme.accent} />
        </View>
        {!!label && <Text style={[Type.label, { color: theme.textSecondary }]}>{label}</Text>}
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
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  tileHorizontal: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  iconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  // Tile heights vary on purpose: tall tools, medium settings, a slim strip.
  tall: { minHeight: 176 },
  large: { minHeight: 132 },
  medium: { minHeight: 100 },
  slim: { minHeight: 60, paddingVertical: Spacing.md },
  bottom: { flex: 1, justifyContent: 'flex-end', gap: 2 },
  bigNumber: { fontFamily: Fonts.title, fontSize: 40, lineHeight: 46 },
  tileTitle: { fontFamily: Fonts.title, fontSize: 22, lineHeight: 28 },
  detail: { fontSize: 14 },
  lastWord: { fontFamily: Fonts.word, fontSize: 17, marginTop: Spacing.xs },
  value: { fontFamily: Fonts.title, fontSize: 22, lineHeight: 28 },
  level: { fontFamily: Fonts.word, fontSize: 44, lineHeight: 50 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  pill: { borderRadius: Radius.chip, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  pillText: { fontSize: 13, fontWeight: '600' },
  slimText: { flex: 1, fontSize: 15 },
  slimStrong: { fontWeight: '600' },
});
