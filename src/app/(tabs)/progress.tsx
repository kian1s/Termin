import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Doodle, DoodleName } from '@/components/doodle-icons';
import { Sticker } from '@/components/sticker';
import { Fonts, mixColors, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { currentStreak, dayKey, STAGES, wasActive } from '@/lib/progress';

const BOXES = [1, 2, 3, 4] as const;
// Each Leitner stage as a plant growing in soil, with what it means.
const STAGE_ART: { icon: DoodleName; meaning: string }[] = [
  { icon: 'seed', meaning: 'Back in a few cards' },
  { icon: 'sprout', meaning: 'Back after 1 day' },
  { icon: 'plant', meaning: 'Back after 3 days' },
  { icon: 'flower', meaning: 'Back after 7 days' },
];
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

// Monday to Sunday of the current week.
function thisWeek() {
  const today = new Date();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7));
  return WEEKDAYS.map((_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i));
}

// SPEC 4.7: all numbers are computed from local data.
export default function ProgressScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { seenIds, savedIds, reviews, stats, devNumbers } = useAppState();

  const perBox = BOXES.map((box) => [...savedIds].filter((id) => reviews[id]?.box === box).length);
  const total = perBox.reduce((a, b) => a + b, 0);
  const shade = (i: number) => mixColors(theme.accentSoft, theme.accent, (i + 1) / 4);
  const streak = currentStreak(stats);
  const today = dayKey();
  const activeToday = stats.lastActive === today;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: theme.text }]}>Progress</Text>
      </View>

      {/* Streak and this week */}
      <Sticker contentStyle={styles.card}>
        <View style={styles.streakHead}>
          <Doodle name="flame" size={44} filled={activeToday} />
          <View style={styles.flex}>
            <Text style={[styles.streakNumber, { color: theme.text }]}>
              {streak} {streak === 1 ? 'day' : 'days'}
            </Text>
            <Text style={[styles.detail, { color: theme.textSecondary }]}>
              {activeToday ? 'Today counts. ' : 'Answer a review or see 10 cards today. '}Best: {stats.best}
            </Text>
          </View>
        </View>
        <Text style={[Type.label, { color: theme.textSecondary }]}>This week</Text>
        <View style={styles.week}>
          {thisWeek().map((date, i) => {
            const key = dayKey(date);
            const active = wasActive(stats, date);
            const isToday = key === today;
            const future = key > today;
            return (
              <View key={key} style={styles.day}>
                <Text style={[styles.dayLetter, { color: isToday ? theme.text : theme.textSecondary }]}>
                  {WEEKDAYS[i]}
                </Text>
                <View
                  style={[
                    styles.stamp,
                    active
                      ? { backgroundColor: theme.spark, borderColor: theme.text }
                      : {
                          borderColor: isToday ? theme.text : theme.border,
                          borderStyle: isToday ? 'dashed' : 'solid',
                          opacity: future ? 0.5 : 1,
                        },
                  ]}>
                  {active && <Doodle name="check" size={20} color={theme.background} />}
                </View>
              </View>
            );
          })}
        </View>
      </Sticker>

      {/* Numbers, in pairs */}
      <View style={styles.row}>
        {/* Developer mode can set these for filming. */}
        <Stat label="Learned" value={devNumbers.learned ?? perBox[3]} />
        <Stat label="Saved" value={savedIds.size} />
      </View>
      <View style={styles.row}>
        <Stat label="Seen" value={devNumbers.seen ?? seenIds.size} />
        <Stat label="Reviews today" value={devNumbers.reviewsToday ?? stats.reviewsToday} />
      </View>

      {/* Saved words: one bar, then the four stages as a growing plant */}
      <Sticker contentStyle={styles.card}>
        <View style={styles.savedHead}>
          <Text style={[Type.label, { color: theme.textSecondary }]}>Saved words</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{total} in total</Text>
        </View>
        <View style={[styles.bar, { backgroundColor: theme.background, borderColor: theme.text }]}>
          {total > 0 &&
            perBox.map((count, i) =>
              count > 0 ? <View key={i} style={{ flex: count, backgroundColor: shade(i) }} /> : null
            )}
        </View>
        <View style={styles.stages}>
          {STAGES.map((stage, i) => (
            <View key={stage} style={styles.stage}>
              <Doodle name={STAGE_ART[i].icon} size={34} />
              <View style={styles.flex}>
                <View style={styles.stageTop}>
                  <View style={[styles.swatch, { backgroundColor: shade(i), borderColor: theme.text }]} />
                  <Text style={[styles.stageName, { color: theme.text }]}>{stage}</Text>
                  <Text style={[styles.stageCount, { color: theme.text }]}>{perBox[i]}</Text>
                </View>
                <Text style={[styles.stageMeaning, { color: theme.textSecondary }]}>{STAGE_ART[i].meaning}</Text>
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.detail, { color: theme.textSecondary }]}>
          {total === 0
            ? 'No saved words yet. Tap the heart on a card in the feed, and it will be planted here.'
            : 'Know a word in a review and it grows one step. Miss it and it starts again as a seed.'}
        </Text>
      </Sticker>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const theme = useTheme();
  return (
    <Sticker style={styles.flex} contentStyle={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[Type.label, { color: theme.textSecondary }]}>{label}</Text>
    </Sticker>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.sm },
  titleBlock: { paddingHorizontal: Spacing.xs, gap: Spacing.xs, marginBottom: Spacing.md },
  title: { fontFamily: Fonts.title, fontSize: 28 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.sm },
  card: { padding: Spacing.lg, gap: Spacing.md },
  detail: { fontSize: 14, lineHeight: 20 },
  streakHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  streakNumber: { fontFamily: Fonts.title, fontSize: 28, lineHeight: 34 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { alignItems: 'center', gap: Spacing.xs },
  dayLetter: { fontSize: 13, fontWeight: '600' },
  stamp: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stat: { padding: Spacing.lg, gap: Spacing.xs },
  statValue: { fontFamily: Fonts.title, fontSize: 32, lineHeight: 38 },
  savedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bar: { height: 16, borderRadius: Radius.chip, borderWidth: 1.5, flexDirection: 'row', overflow: 'hidden' },
  stages: { gap: Spacing.md },
  stage: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stageTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1 },
  stageName: { flex: 1, fontSize: 16, fontWeight: '600' },
  stageCount: { fontFamily: Fonts.title, fontSize: 20 },
  stageMeaning: { fontSize: 13, marginLeft: 12 + Spacing.sm },
});
