import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Example, Translation, WordHeading } from '@/components/word-card';
import { Sticker, StickerButton } from '@/components/sticker';
import { Fonts, mixColors, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { isDue, STAGES } from '@/lib/progress';
import { ReviewState, WordEntry } from '@/lib/types';
import { shuffled, wordById } from '@/lib/words';

const BOXES = [1, 2, 3, 4] as const;

// SPEC 4.15: due words first, then lower boxes first, shuffled within each group.
function deckFor(words: WordEntry[], reviews: Record<string, ReviewState>, cardsViewed: number) {
  const groups = new Map<string, WordEntry[]>();
  for (const w of words) {
    const r = reviews[w.id];
    const key = `${r && isDue(r, cardsViewed) ? 0 : 1}-${r?.box ?? 1}`;
    groups.set(key, [...(groups.get(key) ?? []), w]);
  }
  return [...groups.keys()].sort().flatMap((k) => shuffled(groups.get(k)!));
}

// Premium flashcards for one set. Rating updates the Leitner box exactly like
// self-rating on a review card, and counts toward reviews today and the streak.
export default function Flashcards() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { sets, reviews, stats, answer, settings } = useAppState();
  const set = sets.find((s) => s.id === setId);
  const words = (set?.wordIds ?? []).map(wordById).filter((w): w is WordEntry => !!w);

  const [deck, setDeck] = useState(() => deckFor(words, reviews, stats.cardsViewed));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [back] = useState(() => new Animated.Value(0));

  if (!set || !settings) return null;

  const flip = () => {
    if (flipped) return;
    setFlipped(true);
    // DESIGN.md 8: a short crossfade instead of a bouncy 3D flip.
    Animated.timing(back, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  const rate = (correct: boolean) => {
    answer(deck[index].id, correct);
    if (correct) setKnown((k) => k + 1);
    back.setValue(0);
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  const restart = () => {
    setDeck(deckFor(words, reviews, stats.cardsViewed));
    setIndex(0);
    setKnown(0);
    setFlipped(false);
    back.setValue(0);
  };

  // End screen.
  if (index >= deck.length) {
    const perBox = BOXES.map((b) => words.filter((w) => (reviews[w.id]?.box ?? 1) === b).length);
    return (
      <View style={[styles.screen, styles.center, { backgroundColor: theme.background }]}>
        <Text style={[styles.endTitle, { color: theme.text }]}>
          {deck.length} {deck.length === 1 ? 'card' : 'cards'} · {known} known
        </Text>
        <View style={styles.boxes}>
          {BOXES.map((b, i) => (
            <View key={b} style={styles.boxRow}>
              <View style={[styles.swatch, { backgroundColor: mixColors(theme.accentSoft, theme.accent, i / 3) }]} />
              <Text style={[styles.boxText, { color: theme.textSecondary }]}>
                {STAGES[i]}: {perBox[i]} {perBox[i] === 1 ? 'word' : 'words'}
              </Text>
            </View>
          ))}
        </View>
        <StickerButton label="Study again" onPress={restart} style={styles.button} />
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={[styles.textButton, { color: theme.accent }]}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const word = deck[index];
  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.lg }]}>
      <Text style={[Type.label, styles.counter, { color: theme.textSecondary }]}>
        {index + 1} / {deck.length}
      </Text>

      <Sticker
        onPress={flip}
        disabled={flipped}
        style={styles.card}
        contentStyle={styles.cardFace}
        accessibilityLabel={flipped ? word.word : `${word.word}. Tap to see the meaning`}>
        <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
          <WordHeading word={word} />
          {flipped ? (
            <Animated.View style={[styles.back, { opacity: back }]}>
              <Text style={[Type.body, { color: theme.text }]}>{word.definition}</Text>
              <Example text={word.example} />
              <Translation word={word} nativeLang={settings.nativeLang} blurred={false} />
            </Animated.View>
          ) : (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>Tap to see the meaning</Text>
          )}
        </ScrollView>
      </Sticker>

      {flipped && (
        <View style={styles.row}>
          <StickerButton label="Didn't know" variant="secondary" onPress={() => rate(false)} style={styles.rateButton} />
          <StickerButton label="Knew it" onPress={() => rate(true)} style={styles.rateButton} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: Spacing.lg, gap: Spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  counter: { textAlign: 'center', marginTop: Spacing.md },
  card: { flex: 1 },
  cardFace: { flex: 1 },
  cardContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  back: { gap: Spacing.lg },
  hint: { fontSize: 15, textAlign: 'center', marginTop: Spacing.lg },
  row: { flexDirection: 'row', gap: Spacing.md },
  rateButton: { flex: 1 },
  button: { marginTop: Spacing.lg },
  buttonText: { fontSize: 17, fontWeight: '600' },
  textButton: { fontSize: 17, fontWeight: '600', padding: Spacing.sm },
  endTitle: { fontFamily: Fonts.title, fontSize: 28, textAlign: 'center' },
  boxes: { gap: Spacing.sm },
  boxRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swatch: { width: 12, height: 12, borderRadius: 6 },
  boxText: { fontSize: 16 },
});
