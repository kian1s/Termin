import Ionicons from '@expo/vector-icons/Ionicons';
import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, mixColors, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { currentStreak } from '@/lib/progress';

const BOXES = [1, 2, 3, 4] as const;

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
          icon={<Ionicons name="flame" size={26} color={theme.accent} />}
        />
        <Stat label="Best streak" value={stats.best} />
      </View>

      <View style={styles.boxes}>
        <Text style={[Type.label, { color: theme.textSecondary }]}>Saved words by box</Text>
        <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {total > 0 &&
            perBox.map((count, i) =>
              count > 0 ? (
                <View
                  key={i}
                  style={{
                    flex: count,
                    backgroundColor: mixColors(theme.accentSoft, theme.accent, i / 3),
                  }}
                />
              ) : null
            )}
        </View>
        <View style={styles.legend}>
          {BOXES.map((box, i) => (
            <View key={box} style={styles.legendItem}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: mixColors(theme.accentSoft, theme.accent, i / 3) },
                ]}
              />
              <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                Box {box}: {perBox[i]}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          A word moves up a box each time you know it and back to box 1 when you don’t. Box 4 means
          learned.
        </Text>
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
  bar: {
    height: 16,
    borderRadius: Radius.chip,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 14 },
  hint: { fontSize: 14, lineHeight: 20 },
});
