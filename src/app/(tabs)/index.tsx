import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CreditPill } from '@/components/credit-pill';
import { Doodle } from '@/components/doodle-icons';
import { LevelUpCard, LockedCard } from '@/components/pro-cards';
import { ReviewCard } from '@/components/review-card';
import { WordCard } from '@/components/word-card';
import { StickerButton } from '@/components/sticker';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { useCredit } from '@/lib/credits';
import { isFreeWord, isLockedWord, isPremiumCategory, levelAbove, stretchEvery, TEASER_EVERY } from '@/lib/gating';
import { usePremium } from '@/lib/premium';
import { currentStreak, dayKey } from '@/lib/progress';
import { CATEGORY_NAMES, Level, WordEntry } from '@/lib/types';
import { allWords, shuffled, wordById, wordsAt, wordsFor } from '@/lib/words';

type Item = { key: string; kind: 'word' | 'review' | 'stretch' | 'locked' | 'levelup'; word: WordEntry };

// What goes into the feed besides the user's own words (SPEC 4.12 and 5).
type Mix = {
  pool: WordEntry[];
  stretchPool: WordEntry[];
  stretchEvery: number | null;
  teaserPool: WordEntry[];
  teaserEvery: number | null;
  earnedLevel: Level | null; // set when teasers are earned by doing well (SPEC 4.12)
  levelUp: { level: Level; locked: boolean } | null;
};

const MIN_BATCH = 20;
// SPEC 4.4: every 5th card is a review card when a saved word is due.
const CARDS_BETWEEN_REVIEWS = 4;
// SPEC 4.12: the one-time level-up card after 80% of the level's words were seen.
const LEVEL_UP_SEEN = 0.8;
let nextKey = 0;

const pick = (words: WordEntry[]) => words[Math.floor(Math.random() * words.length)];

// The feed repeats the filtered words in shuffled rounds so it never ends,
// slotting in stretch and locked teaser cards at their rates.
function nextBatch(mix: Mix, prev: Item[], count: { words: number }, levelUpNow: boolean): Item[] {
  const out: Item[] = [];
  const add = (kind: Item['kind'], word: WordEntry) => out.push({ key: `${nextKey++}`, kind, word });
  if (levelUpNow && mix.levelUp) add('levelup', mix.pool[0]);
  let last = prev[prev.length - 1]?.word;
  while (mix.pool.length && out.length < MIN_BATCH) {
    for (const word of shuffled(mix.pool, last)) {
      add('word', word);
      last = word;
      count.words++;
      if (mix.stretchEvery && count.words % mix.stretchEvery === 0 && mix.stretchPool.length) {
        add('stretch', pick(mix.stretchPool));
      }
      if (mix.teaserEvery && count.words % mix.teaserEvery === 0 && mix.teaserPool.length) {
        add('locked', pick(mix.teaserPool));
      }
    }
  }
  return out;
}

export default function Feed() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const {
    settings,
    saveSettings,
    seenIds,
    markSeen,
    recordCardView,
    findDueWord,
    stats,
    reviews,
    recentAnswers,
    levelUpShown,
    markLevelUpShown,
    devStrongLearner,
  } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const snapCredit = useCredit('snap');
  const [height, setHeight] = useState(0);

  // Only the learning filters and Premium status matter here; changing the reminder
  // or answering a review must not reset the feed.
  const filterKey = settings
    ? `${settings.learningLang}|${settings.level}|${settings.categories.join()}|${isPremium}|${devStrongLearner}`
    : '';
  const mix = useMemo<Mix>(() => {
    if (!settings) {
      return { pool: [], stretchPool: [], stretchEvery: null, teaserPool: [], teaserEvery: null, earnedLevel: null, levelUp: null };
    }
    const { learningLang: lang, level, categories } = settings;
    const open = (w: WordEntry) => !isLockedWord(w, isPremium);
    // Free users also get the few sample words of the Premium categories at their level.
    const samples = isPremium
      ? []
      : allWords(lang).filter((w) => w.level === level && isPremiumCategory(w.category) && isFreeWord(w));
    const pool = [...wordsFor(settings).filter(open), ...samples];
    const up = levelAbove(level);
    const upWords = up ? wordsAt(lang, up, categories) : [];
    const every = up ? stretchEvery(recentAnswers, reviews, devStrongLearner) : null;
    const upLocked = upWords.filter((w) => !open(w));
    // A free learner who is ready for the next level gets its locked words as teasers.
    const earned = !isPremium && every !== null && upLocked.length > 0;
    return {
      pool,
      stretchPool: upWords.filter(open),
      stretchEvery: every,
      teaserPool: earned ? upLocked : allWords(lang).filter((w) => w.level === level && !open(w)),
      teaserEvery: isPremium ? null : TEASER_EVERY,
      earnedLevel: earned ? up : null,
      levelUp: up && !levelUpShown.includes(`${lang}|${level}`) ? { level: up, locked: false } : null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey]);

  // `count` numbers the word cards so stretch and teaser cards keep their rate across batches.
  const newFeed = (m: Mix) => {
    const count = { words: 0 };
    return { mix: m, count, items: nextBatch(m, [], count, false) };
  };
  const [feed, setFeed] = useState(() => newFeed(mix));
  // A review card on screen blocks swiping until it is answered or revealed.
  const [blockingKey, setBlockingKey] = useState<string | null>(null);
  const [doneReviews, setDoneReviews] = useState<Set<string>>(() => new Set());
  if (feed.mix !== mix) {
    setFeed(newFeed(mix));
    setBlockingKey(null);
  }

  const latest = useRef({ seenIds, learningLang: settings?.learningLang, level: settings?.level });
  useEffect(() => {
    latest.current = { seenIds, learningLang: settings?.learningLang, level: settings?.level };
  });
  const viewedKeys = useRef(new Set<string>());
  const listRef = useRef<FlatList<Item>>(null);
  const sinceReview = useRef(0);

  const levelUpDue = (m: Mix) =>
    !!m.levelUp &&
    m.pool.length > 0 &&
    m.pool.filter((w) => latest.current.seenIds.has(w.id)).length / m.pool.length >= LEVEL_UP_SEEN;

  const [onViewableItemsChanged] = useState(
    () =>
      ({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
        for (const { item, index } of viewableItems) {
          if (!item || index == null || viewedKeys.current.has(item.key)) continue;
          viewedKeys.current.add(item.key);
          recordCardView();

          if (item.kind === 'word' || item.kind === 'stretch') {
            markSeen(item.word.id);
            sinceReview.current++;
          } else if (item.kind === 'review') {
            sinceReview.current = 0;
          } else if (item.kind === 'levelup') {
            markLevelUpShown(`${latest.current.learningLang}|${latest.current.level}`);
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

  const onLevelUp = (level: Level, locked: boolean) => {
    if (locked) showPaywall();
    else saveSettings({ ...settings, level });
  };

  const teaserMessage = (w: WordEntry) =>
    mix.earnedLevel
      ? `You're ready for ${mix.earnedLevel}`
      : isPremiumCategory(w.category)
        ? `Unlock ${CATEGORY_NAMES[w.category]} with Premium`
        : `Unlock all ${w.level} words`;

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'review':
        return (
          <ReviewCard
            word={item.word}
            nativeLang={settings.nativeLang}
            height={height}
            active={blockingKey === item.key || doneReviews.has(item.key)}
            onFinished={() => {
              setDoneReviews((d) => new Set(d).add(item.key));
              setBlockingKey(null);
            }}
          />
        );
      case 'locked':
        return (
          <LockedCard word={item.word} message={teaserMessage(item.word)} height={height} onPress={showPaywall} />
        );
      case 'levelup':
        return mix.levelUp ? (
          <LevelUpCard
            level={mix.levelUp.level}
            locked={mix.levelUp.locked}
            height={height}
            onPress={() => onLevelUp(mix.levelUp!.level, mix.levelUp!.locked)}
          />
        ) : null;
      default:
        return (
          <WordCard
            word={item.word}
            nativeLang={settings.nativeLang}
            height={height}
            badge={item.kind === 'stretch' ? `Stretch · ${item.word.level}` : undefined}
          />
        );
    }
  };

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top }]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height - insets.top)}>
      {mix.pool.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No words here yet</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            {isPremium
              ? 'Try another level or category in Practice.'
              : 'These categories need Premium. Upgrade, or add Academic or Everyday in Practice.'}
          </Text>
          <StickerButton
            label={isPremium ? 'Open Practice' : 'See Premium'}
            variant={isPremium ? 'primary' : 'premium'}
            onPress={() => (isPremium ? router.push('/practice') : showPaywall())}
            style={styles.button}
          />
        </View>
      ) : (
        height > 0 && (
          <FlatList
            ref={listRef}
            data={feed.items}
            keyExtractor={(i) => i.key}
            renderItem={renderItem}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            pagingEnabled
            decelerationRate="fast"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onEndReached={() =>
              setFeed((f) => {
                // The level-up card goes in once, when it becomes due.
                const due = levelUpDue(f.mix) && !f.items.some((i) => i.kind === 'levelup');
                return { ...f, items: [...f.items, ...nextBatch(f.mix, f.items, f.count, due)] };
              })
            }
            onEndReachedThreshold={3}
            onViewableItemsChanged={onViewableItemsChanged}
            scrollEnabled={!blockingKey}
            // One card per swipe, so a fast flick cannot skip ahead.
            disableIntervalMomentum
            scrollEventThrottle={16}
            onScroll={(e) => {
              // Hard stop: never scroll past an unfinished review card, however
              // fast the swipe. Reviews are only added ahead of the current card.
              const stop = feed.items.findIndex((i) => i.kind === 'review' && !doneReviews.has(i.key));
              if (stop >= 0 && e.nativeEvent.contentOffset.y > stop * height + 1) {
                listRef.current?.scrollToOffset({ offset: stop * height, animated: false });
                setBlockingKey(feed.items[stop].key);
              }
            }}
            onMomentumScrollEnd={(e) => {
              // Once the feed settles on an unfinished review card, lock it there.
              const item = feed.items[Math.round(e.nativeEvent.contentOffset.y / height)];
              if (item?.kind === 'review' && !doneReviews.has(item.key)) setBlockingKey(item.key);
            }}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            windowSize={5}
          />
        )
      )}

      {/* Top left: Snap a word (SPEC 4.19). */}
      <View style={[styles.headerLeft, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <Pressable onPress={() => router.push('/snap')} hitSlop={10} accessibilityLabel="Snap a word">
          {snapCredit ? <CreditPill kind="snap" /> : <Doodle name="camera" size={24} color={theme.textSecondary} />}
        </Pressable>
      </View>

      <View style={[styles.header, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
        <Pressable onPress={() => router.push('/history')} hitSlop={10} accessibilityLabel="History">
          <Doodle name="history" size={24} color={theme.textSecondary} />
        </Pressable>
        <View style={styles.streak} pointerEvents="none">
          <Doodle name="flame" size={22} filled={stats.lastActive === dayKey()} />
          <Text style={[styles.streakText, { color: theme.spark }]}>{streak}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.md },
  emptyTitle: { fontFamily: Fonts.title, fontSize: 28 },
  emptyText: { fontSize: 17, lineHeight: 24 },
  button: { marginTop: Spacing.md },
  buttonText: { fontSize: 17, fontWeight: '600' },
  header: {
    position: 'absolute',
    right: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  headerLeft: {
    position: 'absolute',
    left: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  streakText: { fontSize: 16, fontWeight: '600' },
});
