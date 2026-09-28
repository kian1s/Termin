import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ReviewCard } from '@/components/review-card';
import { WordCard } from '@/components/word-card';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { currentStreak } from '@/lib/progress';
import { WordEntry } from '@/lib/types';
import { shuffled, wordById, wordsFor } from '@/lib/words';

type Item = { key: string; kind: 'word' | 'review'; word: WordEntry };

const MIN_BATCH = 20;
// SPEC 4.4: every 5th card is a review card when a saved word is due.
const CARDS_BETWEEN_REVIEWS = 4;
let nextKey = 0;

// The feed repeats the filtered words in shuffled rounds so it never ends.
function nextBatch(pool: WordEntry[], prev: Item[]): Item[] {
  const out: Item[] = [];
  let last = prev[prev.length - 1]?.word;
  while (pool.length && out.length < MIN_BATCH) {
    for (const word of shuffled(pool, last)) {
      out.push({ key: `${nextKey++}`, kind: 'word', word });
      last = word;
    }
  }
  return out;
}

export default function Feed() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, seenIds, markSeen, recordCardView, findDueWord, stats } = useAppState();
  const [height, setHeight] = useState(0);

  // Only the learning filters matter here; changing the reminder must not reset the feed.
  const filterKey = settings
    ? `${settings.learningLang}|${settings.level}|${settings.categories.join()}`
    : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pool = useMemo(() => (settings ? wordsFor(settings) : []), [filterKey]);

  const [feed, setFeed] = useState(() => ({ pool, items: nextBatch(pool, []) }));
  // Per card: was the translation hidden when it first came on screen? Decided
  // once, so a first-time word stays visible even after it is marked seen.
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  if (feed.pool !== pool) {
    setFeed({ pool, items: nextBatch(pool, []) });
    setHidden({});
  }

  const latest = useRef({ seenIds, learningLang: settings?.learningLang });
  useEffect(() => {
    latest.current = { seenIds, learningLang: settings?.learningLang };
  });
  const viewedKeys = useRef(new Set<string>());
  const sinceReview = useRef(0);

  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
        for (const { item, index } of viewableItems) {
          if (!item || index == null || viewedKeys.current.has(item.key)) continue;
          viewedKeys.current.add(item.key);
          recordCardView();

          if (item.kind === 'word') {
            const wasSeen = latest.current.seenIds.has(item.word.id);
            setHidden((h) => ({ ...h, [item.key]: wasSeen }));
            markSeen(item.word.id);
            sinceReview.current++;
          } else {
            sinceReview.current = 0;
          }

          // After enough word cards, slot the most overdue saved word in as the next card.
          if (sinceReview.current >= CARDS_BETWEEN_REVIEWS) {
            const dueId = findDueWord(
              (id) => id !== item.word.id && wordById(id)?.lang === latest.current.learningLang
            );
            const word = dueId ? wordById(dueId) : undefined;
            if (word) {
              sinceReview.current = 0;
              setFeed((f) => {
                const items = [...f.items];
                items.splice(index + 1, 0, { key: `${nextKey++}`, kind: 'review', word });
                return { ...f, items };
              });
            }
          }
        }
      }
  );

  if (!settings) return null;
  const streak = currentStreak(stats);

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height - insets.top)}>
      {pool.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No words yet</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            The sample words are English only for now. Pick English as your learning language in
            Settings, or try another level or category.
          </Text>
        </View>
      ) : (
        height > 0 && (
          <FlatList
            data={feed.items}
            keyExtractor={(i) => i.key}
            renderItem={({ item }) =>
              item.kind === 'review' ? (
                <ReviewCard word={item.word} nativeLang={settings.nativeLang} height={height} />
              ) : (
                <WordCard
                  word={item.word}
                  nativeLang={settings.nativeLang}
                  translationHidden={hidden[item.key] ?? seenIds.has(item.word.id)}
                  height={height}
                />
              )
            }
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            pagingEnabled
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onEndReached={() =>
              setFeed((f) => ({ ...f, items: [...f.items, ...nextBatch(f.pool, f.items)] }))
            }
            onEndReachedThreshold={3}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            windowSize={5}
          />
        )
      )}

      <View style={[styles.streak, { top: insets.top + Spacing.sm }]} pointerEvents="none">
        <Ionicons name="flame" size={18} color={theme.accent} />
        <Text style={[styles.streakText, { color: theme.accent }]}>{streak}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyTitle: { fontFamily: Fonts.title, fontSize: 28 },
  emptyText: { fontSize: 17, lineHeight: 24 },
  streak: {
    position: 'absolute',
    right: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  streakText: { fontSize: 16, fontWeight: '600' },
});
