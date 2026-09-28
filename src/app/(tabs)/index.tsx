import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WordCard } from '@/components/word-card';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { WordEntry } from '@/lib/types';
import { shuffled, wordsFor } from '@/lib/words';

type Item = { key: string; word: WordEntry };

const MIN_BATCH = 20;
let nextKey = 0;

// The feed repeats the filtered words in shuffled rounds so it never ends.
function nextBatch(pool: WordEntry[], prev: Item[]): Item[] {
  const out: Item[] = [];
  let last = prev[prev.length - 1]?.word;
  while (pool.length && out.length < MIN_BATCH) {
    for (const word of shuffled(pool, last)) {
      out.push({ key: `${nextKey++}`, word });
      last = word;
    }
  }
  return out;
}

export default function Feed() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { settings, seenIds, markSeen } = useAppState();
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

  const seenRef = useRef(seenIds);
  useEffect(() => {
    seenRef.current = seenIds;
  }, [seenIds]);

  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
        for (const { item } of viewableItems) {
          if (!item) continue;
          const wasSeen = seenRef.current.has(item.word.id);
          setHidden((h) => (item.key in h ? h : { ...h, [item.key]: wasSeen }));
          markSeen(item.word.id);
        }
      }
  );

  if (!settings) return null;

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
            renderItem={({ item }) => (
              <WordCard
                word={item.word}
                nativeLang={settings.nativeLang}
                translationHidden={hidden[item.key] ?? seenIds.has(item.word.id)}
                height={height}
              />
            )}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            pagingEnabled
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyTitle: { fontFamily: Fonts.title, fontSize: 28 },
  emptyText: { fontSize: 17, lineHeight: 24 },
});
