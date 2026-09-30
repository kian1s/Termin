import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Doodle } from '@/components/doodle-icons';
import { ReviewCard } from '@/components/review-card';
import { Sticker, StickerButton } from '@/components/sticker';
import { WordHeading } from '@/components/word-card';
import { Fonts, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { dueOrder, isDue, STAGES } from '@/lib/progress';
import { ReviewState, WordEntry } from '@/lib/types';
import { wordById } from '@/lib/words';

const QUESTIONS = 5;

// SPEC 4.17: the notified word first, then other saved words in the learning
// language (due first, then the lowest boxes), no repeats.
function deckFor(
  wordId: string | undefined,
  savedIds: Set<string>,
  reviews: Record<string, ReviewState>,
  lang: string,
  cardsViewed: number
): WordEntry[] {
  const first = wordId && savedIds.has(wordId) ? wordById(wordId) : undefined;
  const others = [...savedIds]
    .filter((id) => id !== first?.id && reviews[id])
    .map((id) => wordById(id))
    .filter((w): w is WordEntry => !!w && w.lang === lang)
    .sort((a, b) => {
      const ra = reviews[a.id];
      const rb = reviews[b.id];
      const dueA = isDue(ra, cardsViewed) ? 0 : 1;
      const dueB = isDue(rb, cardsViewed) ? 0 : 1;
      if (dueA !== dueB) return dueA - dueB;
      if (dueA === 0) return dueOrder(ra) - dueOrder(rb);
      return ra.box - rb.box;
    });
  return [...(first ? [first] : []), ...others].slice(0, QUESTIONS);
}

type Stage = 'start' | 'test' | 'end';

// Opened by tapping an AI reminder. The user always chooses: a start card with
// Start test or Skip, a Skip link on every question, and leaving early keeps
// the answers already given.
export default function QuickTest() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { word: wordId } = useLocalSearchParams<{ word?: string }>();
  const { settings, savedIds, reviews, stats } = useAppState();
  const [deck] = useState(() =>
    settings ? deckFor(wordId, savedIds, reviews, settings.learningLang, stats.cardsViewed) : []
  );
  const [stage, setStage] = useState<Stage>('start');
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [height, setHeight] = useState(0);

  if (!settings) return null;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const next = () => (index + 1 < deck.length ? setIndex(index + 1) : setStage('end'));
  const answered = Object.keys(results);
  const current = deck[index];

  const screen = [
    styles.screen,
    { backgroundColor: theme.background, paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg },
  ];

  if (!deck.length) {
    return (
      <View style={[screen, styles.center]}>
        <Text style={[styles.title, { color: theme.text }]}>Nothing to test right now.</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Save a few words from the feed first.</Text>
        <StickerButton label="Back to feed" onPress={leave} style={styles.wide} />
      </View>
    );
  }

  if (stage === 'start') {
    return (
      <View style={[screen, styles.center]}>
        <Sticker style={styles.wide} contentStyle={styles.startCard}>
          <Text style={[Type.label, { color: theme.accent }]}>Quick test</Text>
          <WordHeading word={deck[0]} />
          <Text style={[styles.hint, styles.left, { color: theme.textSecondary }]}>
            {deck.length === 1 ? '1 word' : `${deck.length} words`}, about a minute. Say or type what each one means.
          </Text>
        </Sticker>
        <StickerButton label="Start test" onPress={() => setStage('test')} style={styles.wide} />
        <StickerButton label="Skip, keep scrolling" variant="secondary" onPress={leave} style={styles.wide} />
      </View>
    );
  }

  if (stage === 'end') {
    const correct = answered.filter((id) => results[id]).length;
    return (
      <View style={[screen, styles.center]}>
        <Doodle name="check" size={48} color={theme.accent} />
        <Text style={[styles.title, { color: theme.text }]}>
          {answered.length ? `${correct} / ${answered.length}` : 'No answers this time'}
        </Text>
        <View style={styles.list}>
          {deck
            .filter((w) => w.id in results)
            .map((w) => (
              <View key={w.id} style={styles.resultRow}>
                <Ionicons
                  name={results[w.id] ? 'checkmark-circle' : 'close-circle'}
                  size={20}
                  color={results[w.id] ? theme.correct : theme.wrong}
                />
                <Text style={[styles.resultWord, { color: theme.text }]}>{w.word}</Text>
                <Text style={[styles.resultStage, { color: theme.textSecondary }]}>
                  {STAGES[(reviews[w.id]?.box ?? 1) - 1]}
                </Text>
              </View>
            ))}
        </View>
        <StickerButton label="Back to feed" onPress={leave} style={styles.wide} />
      </View>
    );
  }

  const done = current.id in results;
  return (
    <View style={screen}>
      <View style={styles.header}>
        <Pressable onPress={() => setStage('end')} hitSlop={10} accessibilityLabel="Stop the test">
          <Ionicons name="close" size={26} color={theme.textSecondary} />
        </Pressable>
        <Text style={[Type.label, { color: theme.textSecondary }]}>
          {index + 1} / {deck.length}
        </Text>
        <Pressable onPress={next} hitSlop={10} disabled={done} accessibilityRole="button">
          <Text style={[styles.link, { color: done ? theme.border : theme.accent }]}>Skip</Text>
        </Pressable>
      </View>
      <View style={styles.cardArea} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
        {height > 0 && (
          <ReviewCard
            key={current.id}
            word={current}
            nativeLang={settings.nativeLang}
            height={height}
            onFinished={(ok) => setResults((r) => ({ ...r, [current.id]: ok }))}
          />
        )}
      </View>
      <StickerButton
        label={index + 1 < deck.length ? 'Next' : 'See results'}
        onPress={next}
        disabled={!done}
        style={styles.wide}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center' },
  wide: { alignSelf: 'stretch' },
  startCard: { padding: Spacing.xl, gap: Spacing.lg },
  title: { fontFamily: Fonts.title, fontSize: 28, textAlign: 'center' },
  hint: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  left: { textAlign: 'left' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { fontSize: 17, fontWeight: '600' },
  cardArea: { flex: 1, marginHorizontal: -Spacing.lg },
  list: { alignSelf: 'stretch', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  resultWord: { fontSize: 17, fontWeight: '600', flex: 1 },
  resultStage: { fontSize: 15 },
});
