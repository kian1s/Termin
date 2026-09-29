import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, mixColors, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { currentStreak } from '@/lib/progress';

const BOXES = [1, 2, 3, 4] as const;
// What each Leitner box means for the learner (SPEC 4.4 timings).
const BOX_INFO = [
  { name: 'New', meaning: 'Comes back within a few cards' },
  { name: 'Learning', meaning: 'Comes back after 1 day' },
  { name: 'Familiar', meaning: 'Comes back after 3 days' },
  { name: 'Learned', meaning: 'Comes back after 7 days' },
];

// SPEC 4.7: all numbers are computed from local data.
export default function ProgressScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { seenIds, savedIds, reviews, stats } = useAppState();

  const perBox = BOXES.map((box) => [...savedIds].filter((id) => reviews[id]?.box === box).length);
  const learned = perBox[3];
  const total = perBox.reduce((a, b) => a + b, 0);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Progress</Text>

      <View style={styles.grid}>
        <Stat label="Words learned" value={learned} />
        <Stat label="Saved" value={savedIds.size} />
        <Stat label="Seen" value={seenIds.size} />
        <Stat label="Reviews today" value={stats.reviewsToday} />
        <Stat
          label="Streak"
          value={currentStreak(stats)}
          icon={<Ionicons name="flame" size={26} color={theme.spark} />}
        />
        <Stat label="Best streak" value={stats.best} />
      </View>

      <View style={styles.boxes}>
        <Text style={[Type.label, { color: theme.textSecondary }]}>Saved words by box</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Every saved word sits in one of four boxes. Know it in a review and it moves up a box, so it comes
          back less often. Miss it and it starts again in box 1.
        </Text>
        <View style={[styles.boxList, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {BOXES.map((box, i) => {
            const count = perBox[i];
            const color = mixColors(theme.accentSoft, theme.accent, (i + 1) / 4);
            return (
              <View
                key={box}
                style={[styles.boxRow, i < BOXES.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <View style={styles.boxHead}>
                  <View style={[styles.swatch, { backgroundColor: color }]} />
                  <Text style={[styles.boxName, { color: theme.text }]}>
                    Box {box} · {BOX_INFO[i].name}
                  </Text>
                  <Text style={[styles.boxCount, { color: theme.text }]}>{count}</Text>
                </View>
                <Text style={[styles.boxMeaning, { color: theme.textSecondary }]}>{BOX_INFO[i].meaning}</Text>
                <View style={[styles.track, { backgroundColor: theme.background }]}>
                  <View style={[styles.fill, { backgroundColor: color, width: `${total ? (count / total) * 100 : 0}%` }]} />
                </View>
              </View>
            );
          })}
        </View>
        {total === 0 && (
          <Text style={[styles.hint, { color: theme.text }]}>
            No saved words yet. Tap the heart on a card in the feed, and it will start here in box 1.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <View style={styles.statValueRow}>
        {icon}
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      </View>
      <Text style={[Type.label, { color: theme.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl, gap: Spacing.xxl },
  title: { fontFamily: Fonts.title, fontSize: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: Spacing.xl },
  stat: { width: '50%', gap: Spacing.xs },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  statValue: { fontFamily: Fonts.title, fontSize: 40, lineHeight: 48 },
  boxes: { gap: Spacing.md },
  boxList: { borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: Spacing.lg },
  boxRow: { paddingVertical: Spacing.md, gap: Spacing.xs },
  boxHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  boxName: { flex: 1, fontSize: 16, fontWeight: '600' },
  boxCount: { fontFamily: Fonts.title, fontSize: 20 },
  boxMeaning: { fontSize: 14, marginLeft: 12 + Spacing.sm },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.xs },
  fill: { height: 6, borderRadius: 3 },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  hint: { fontSize: 14, lineHeight: 20 },
});
