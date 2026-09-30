import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { Doodle } from '@/components/doodle-icons';
import { Sticker, StickerButton } from '@/components/sticker';
import { WordHeading } from '@/components/word-card';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { coachAvailable, TabooResult, tabooGuess } from '@/lib/coach';
import { setCreditLeft, useCredit } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { dueOrder, isDue } from '@/lib/progress';
import { coachFeedbackLang, ReviewState, Settings, WordEntry } from '@/lib/types';
import { useVoiceAnswer } from '@/lib/voice';
import { shuffled, wordById, wordsAt } from '@/lib/words';

const WORDS_PER_ROUND = 5;

type Turn = { word: WordEntry; options: WordEntry[] };

// A round: up to 5 saved words in the learning language (due first, then the
// lowest boxes), each with 3 other words to choose from: other saved words
// first, then words at the user's level.
function buildRound(settings: Settings, savedIds: Set<string>, reviews: Record<string, ReviewState>, cardsViewed: number) {
  const saved = [...savedIds]
    .map((id) => wordById(id))
    .filter((w): w is WordEntry => !!w && w.lang === settings.learningLang && !!reviews[w.id]);
  const ordered = [...saved].sort((a, b) => {
    const ra = reviews[a.id];
    const rb = reviews[b.id];
    const dueA = isDue(ra, cardsViewed) ? 0 : 1;
    const dueB = isDue(rb, cardsViewed) ? 0 : 1;
    if (dueA !== dueB) return dueA - dueB;
    return dueA === 0 ? dueOrder(ra) - dueOrder(rb) : ra.box - rb.box;
  });
  const fillers = shuffled(wordsAt(settings.learningLang, settings.level, settings.categories));
  const turns: Turn[] = ordered.slice(0, WORDS_PER_ROUND).map((word) => {
    const others = [...shuffled(saved.filter((w) => w.id !== word.id)), ...fillers.filter((w) => w.id !== word.id)];
    const unique = others.filter((w, i) => others.findIndex((o) => o.id === w.id) === i).slice(0, 3);
    return { word, options: shuffled([word, ...unique]) };
  });
  return { id: `r${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`, turns };
}

// SPEC 4.24: describe a saved word without saying it; the AI guesses which of
// 4 words you meant. Premium only, 10 rounds a day. A correct guess counts as
// a correct review; a miss records nothing.
export default function Taboo() {
  const theme = useTheme();
  const { settings, savedIds, reviews, stats, answer } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const credit = useCredit('taboo');
  const [round, setRound] = useState<{ id: string; turns: Turn[] } | null>(null);
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [hint, setHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TabooResult | null>(null);
  const [score, setScore] = useState<boolean[]>([]);
  const turn = round?.turns[index];
  const voice = useVoiceAnswer({ lang: settings?.learningLang ?? 'en', word: turn?.word.word }, (spoken) =>
    setText((t) => (t.trim() ? `${t.trim()} ${spoken}` : spoken).slice(0, 500))
  );

  if (!settings) return null;

  const header = (
    <Stack.Screen
      options={{
        unstable_headerRightItems: () => [
          { type: 'custom', element: <CreditPill kind="taboo" />, hidesSharedBackground: true },
        ],
      }}
    />
  );

  if (!isPremium) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <Doodle name="guess" size={48} />
        <Text style={[styles.title, { color: theme.text }]}>Explain it</Text>
        <Text style={[styles.hint, styles.centerText, { color: theme.textSecondary }]}>
          Describe your words without saying them, and see if the AI can guess. Part of Termin Premium.
        </Text>
        <StickerButton label="See Premium" variant="premium" onPress={showPaywall} style={styles.wide} />
      </View>
    );
  }

  const start = () => {
    const next = buildRound(settings, savedIds, reviews, stats.cardsViewed);
    if (!next.turns.length) {
      Alert.alert('No saved words yet', 'Save a few words from the feed first, then play.');
      return;
    }
    setRound(next);
    setIndex(0);
    setScore([]);
    setText('');
    setHint(false);
    setResult(null);
  };

  // Start screen and end screen share the layout.
  if (!round || index >= round.turns.length) {
    const played = score.length;
    const right = score.filter(Boolean).length;
    const out = credit?.left === 0;
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        {header}
        <Doodle name="guess" size={48} />
        <Text style={[styles.title, { color: theme.text }]}>{played ? `${right} / ${played}` : 'Explain it'}</Text>
        <Text style={[styles.hint, styles.centerText, { color: theme.textSecondary }]}>
          {played
            ? 'Words the AI guessed moved up a stage.'
            : `Describe ${WORDS_PER_ROUND} of your saved words without saying them. The AI guesses which one you mean.`}
        </Text>
        {out ? (
          <Text style={[styles.hint, styles.centerText, { color: theme.textSecondary }]}>
            You&apos;ve played today&apos;s 10 rounds. More tomorrow.
          </Text>
        ) : (
          <StickerButton label={played ? 'Play again' : 'Start a round'} onPress={start} style={styles.wide} disabled={!coachAvailable} />
        )}
        {played > 0 && (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={[styles.link, { color: theme.accent }]}>Done</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const current = turn!;
  const busy = loading || voice.state !== 'idle';

  const guess = async () => {
    setLoading(true);
    const out = await tabooGuess(
      round.id,
      // The round's first guess uses one of the day's rounds (skipped words don't).
      score.length === 0,
      current.word,
      current.options,
      text.trim(),
      coachFeedbackLang(settings),
      isPremium
    );
    setLoading(false);
    if (out === 'limit') {
      setCreditLeft('taboo', 0);
      setRound(null);
      return;
    }
    if (out === 'network') {
      Alert.alert('The AI could not guess', 'Check your connection and try again.');
      return;
    }
    if (out.remaining !== undefined) setCreditLeft('taboo', out.remaining);
    if (out.correct) answer(current.word.id, true);
    setResult(out);
    setScore((s) => [...s, out.correct]);
  };

  const next = () => {
    setIndex(index + 1);
    setText('');
    setHint(false);
    setResult(null);
  };

  const guessed = result && current.options.find((o) => o.id === result.guessId);
  const verdictColor = result ? (result.correct ? theme.correct : theme.wrong) : theme.border;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      {header}
      <Text style={[Type.label, { color: theme.textSecondary }]}>
        Word {index + 1} of {round.turns.length}
      </Text>
      <Sticker contentStyle={styles.card}>
        <WordHeading word={current.word} />
        {hint ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>{current.word.definition}</Text>
        ) : (
          <Pressable onPress={() => setHint(true)} hitSlop={8}>
            <Text style={[styles.link, { color: theme.accent }]}>Need a hint? Show the meaning</Text>
          </Pressable>
        )}
      </Sticker>

      {!result ? (
        <>
          <Text style={[styles.body, { color: theme.text }]}>Describe it without saying it.</Text>
          <View>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Say or type your description…"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              editable={!busy}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
            <Pressable
              onPress={voice.toggle}
              disabled={voice.state === 'transcribing' || loading}
              accessibilityLabel={voice.state === 'recording' ? 'Stop recording' : 'Describe it by voice'}
              style={[styles.mic, { backgroundColor: voice.state === 'recording' ? theme.wrong : theme.accent }]}>
              {voice.state === 'transcribing' ? (
                <ActivityIndicator color={theme.background} />
              ) : (
                <Ionicons name={voice.state === 'recording' ? 'stop' : 'mic'} size={22} color={theme.background} />
              )}
            </Pressable>
          </View>
          {voice.state === 'recording' && (
            <Text style={[styles.small, { color: theme.wrong }]}>Recording… {voice.seconds}s of 30. Tap to stop.</Text>
          )}
          <StickerButton
            label="Let the AI guess"
            onPress={guess}
            loading={loading}
            disabled={!text.trim() || busy}
          />
          <Pressable onPress={next} hitSlop={8} disabled={busy} style={styles.skip}>
            <Text style={[styles.link, { color: theme.textSecondary }]}>Skip this word</Text>
          </Pressable>
        </>
      ) : (
        <>
          <View style={[styles.result, { backgroundColor: theme.surface, borderColor: verdictColor }]}>
            <View style={styles.verdictRow}>
              <Ionicons name={result.correct ? 'checkmark-circle' : 'close-circle'} size={22} color={verdictColor} />
              <Text style={[styles.verdict, { color: verdictColor }]}>
                {result.usedWord
                  ? 'You said the word itself'
                  : result.correct
                    ? `The AI guessed it: ${current.word.word}`
                    : `The AI guessed: ${guessed?.word ?? '…'}`}
              </Text>
            </View>
            <Text style={[styles.body, { color: theme.text }]}>{result.feedback}</Text>
          </View>
          <StickerButton label={index + 1 < round.turns.length ? 'Next word' : 'See the score'} onPress={next} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  centerText: { textAlign: 'center' },
  wide: { alignSelf: 'stretch' },
  title: { fontFamily: Fonts.title, fontSize: 28 },
  hint: { fontSize: 15, lineHeight: 21 },
  body: { fontSize: 17, lineHeight: 24 },
  small: { fontSize: 13, lineHeight: 18 },
  link: { fontSize: 15, fontWeight: '600' },
  card: { padding: Spacing.xl, gap: Spacing.md },
  input: {
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.chip,
    padding: Spacing.md,
    paddingRight: 64,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  mic: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skip: { alignSelf: 'center' },
  result: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  verdict: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
});
