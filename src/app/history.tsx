import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { Fonts, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { dayKey } from '@/lib/progress';
import { WordEntry } from '@/lib/types';
import { wordById } from '@/lib/words';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Today", "Yesterday", or a short date such as "Mon 28 Sep".
function dayTitle(time: number) {
  const date = new Date(time);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey()) return 'Today';
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// SPEC 4.13: every word card that appeared in the feed, newest first.
export default function History() {
  const theme = useTheme();
  const { seenIds, seenAt } = useAppState();

  const sections = useMemo(() => {
    const dated: { word: WordEntry; time: number }[] = [];
    const earlier: WordEntry[] = [];
    for (const id of seenIds) {
      const word = wordById(id);
      if (!word) continue;
      if (seenAt[id]) dated.push({ word, time: seenAt[id] });
      else earlier.push(word);
    }
    dated.sort((a, b) => b.time - a.time);
    const out: { title: string; data: WordEntry[] }[] = [];
    for (const { word, time } of dated) {
      const title = dayTitle(time);
      if (out[out.length - 1]?.title !== title) out.push({ title, data: [] });
      out[out.length - 1].data.push(word);
    }
    // Words seen before History existed have no time.
    if (earlier.length) out.push({ title: 'Earlier', data: earlier });
    return out;
  }, [seenIds, seenAt]);

  if (sections.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: theme.background }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Words you see in the feed will appear here.
        </Text>
      </View>
    );
  }

  return (
    <SectionList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      sections={sections}
      keyExtractor={(w) => w.id}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <Text style={[Type.label, styles.header, { color: theme.textSecondary }]}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push({ pathname: '/add-to-set/[wordId]', params: { wordId: item.id } })}
          style={({ pressed }) => [
            styles.row,
            { borderBottomColor: theme.border },
            pressed && { backgroundColor: theme.surface },
          ]}
          accessibilityRole="button"
          accessibilityHint="Add to a set">
          <Text style={[styles.word, { color: theme.word }]}>{item.word}</Text>
          <Text style={[styles.definition, { color: theme.textSecondary }]} numberOfLines={2}>
            {item.definition}
          </Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  header: { marginTop: Spacing.xl, marginBottom: Spacing.xs },
  row: { paddingVertical: Spacing.md, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  word: { fontFamily: Fonts.title, fontSize: 20, lineHeight: 26 },
  definition: { fontSize: 15, lineHeight: 20 },
  empty: { flex: 1, justifyContent: 'center', padding: Spacing.xl },
  emptyText: { fontSize: 17, lineHeight: 24, textAlign: 'center' },
});
