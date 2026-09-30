import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { ExplainLink } from '@/components/explain-link';
import { Example, Translation, WordHeading } from '@/components/word-card';
import { Sticker, StickerButton } from '@/components/sticker';
import { Tutor, TutorMood } from '@/components/tutor';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { checkAnswer, coachAvailable, CoachResult } from '@/lib/coach';
import { setCreditLeft } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { describeNext } from '@/lib/progress';
import { useVoiceAnswer } from '@/lib/voice';
import { coachFeedbackLang, Lang, ReviewState, WordEntry } from '@/lib/types';

// `onFinished` fires once the answer is rated (by Tutor or by the user), unlocking the feed.
// `correct` is true for "Knew it" and for a correct or partly right Coach verdict.
// `active`: the feed sets it once it settles on this card, and Tutor pops in then.
// `topInset`: space kept clear at the top for controls drawn over the page (the feed header).
type Props = {
  word: WordEntry;
  nativeLang: Lang;
  height: number;
  active?: boolean;
  topInset?: number;
  onFinished: (correct: boolean) => void;
};

// Tutor sits on top of the card, over its left or right corner.
const TUTOR_SIZE = 64;
// How long the card waits for an answer before Tutor starts to fidget.
const TUTOR_PATIENCE_MS = 8_000;
const TUTOR_OVERHANG = TUTOR_SIZE * 0.7 + Spacing.sm;

// Why the card fell back to Reveal and self-rating instead of Tutor.
type Fallback = 'limit' | 'network' | null;

const VERDICT_TITLE = { correct: 'Correct', partly: 'Partly right', incorrect: 'Not quite' };
// DESIGN.md 3: verdicts always come with an icon, not color alone.
const VERDICT_ICON = { correct: 'checkmark-circle', partly: 'remove-circle', incorrect: 'close-circle' } as const;

// A saved word coming back as a question (SPEC 4.4). With Tutor the
// answer is graded (SPEC 4.5); otherwise the user reveals and rates themselves.
export function ReviewCard({ word, nativeLang, height, active = true, topInset = 0, onFinished }: Props) {
  const theme = useTheme();
  const { answer, settings } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [fallback, setFallback] = useState<Fallback>(null);
  const [revealed, setRevealed] = useState(false);
  const [next, setNext] = useState<{ correct: boolean; state: ReviewState } | null>(null);
  // Tutor's corner. Each word starts in the same one, so the feed alternates.
  const [tutorSide, setTutorSide] = useState<'left' | 'right'>(() =>
    [...word.id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 2 ? 'right' : 'left'
  );
  const flipTutor = () => setTutorSide((s) => (s === 'left' ? 'right' : 'left'));
  // How far he travels between the corners, once the card has been measured.
  const [tutorSpan, setTutorSpan] = useState<number | undefined>(undefined);
  // A miss makes him sad or cross, picked once per card.
  const [missMood] = useState<TutorMood>(() => (Math.random() < 0.5 ? 'sad' : 'angry'));
  const [waitedLong, setWaitedLong] = useState(false);

  // Voice answers fill the text box, so the user can edit before checking.
  const voice = useVoiceAnswer(word, (spoken) => setText((t) => (t.trim() ? `${t.trim()} ${spoken}` : spoken)));
  const busy = checking || voice.state !== 'idle';

  // Rating is what unlocks the feed: Reveal alone is not enough.
  const rate = (correct: boolean) => {
    setNext({ correct, state: answer(word.id, correct) });
    onFinished(correct);
  };

  const check = async () => {
    setChecking(true);
    const feedbackLang = settings ? coachFeedbackLang(settings) : nativeLang;
    const result = await checkAnswer(word, text.trim(), nativeLang, feedbackLang, isPremium);
    setChecking(false);
    if (typeof result === 'string') {
      if (result === 'limit') setCreditLeft('check', 0);
      setFallback(result);
      setRevealed(true);
      return;
    }
    setCoach(result);
    setCreditLeft('check', result.remainingToday);
    setRevealed(true);
    // A "partly" verdict counts as correct for the Leitner schedule.
    rate(result.verdict !== 'incorrect');
  };

  const canCheck = coachAvailable && text.trim().length > 0 && !busy;
  const verdictColor = coach
    ? { correct: theme.correct, partly: theme.partly, incorrect: theme.wrong }[coach.verdict]
    : theme.border;

  // Tutor reacts to the Coach's verdict or to the user's own rating. Otherwise he rests.
  const mood: TutorMood = checking
    ? 'thinking'
    : coach
      ? coach.verdict === 'incorrect'
        ? missMood
        : 'happy'
      : next
        ? next.correct
          ? 'happy'
          : missMood
        : 'rest';

  // Kept waiting: no answer (and no typing) for a while and he fidgets.
  const waiting = active && !checking && !coach && !next;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setWaitedLong(true), TUTOR_PATIENCE_MS);
    return () => {
      clearTimeout(timer);
      setWaitedLong(false);
    };
  }, [waiting, text]);

  // A right answer: after his hop, he leaps across to the other corner.
  useEffect(() => {
    if (mood !== 'happy') return;
    const leap = setTimeout(flipTutor, 900);
    return () => clearTimeout(leap);
  }, [mood]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.page, { height, paddingTop: Spacing.lg + topInset }]}>
      {/* Scrolls inside itself when the Coach's answer makes it taller than the screen. */}
      <View
        style={coachAvailable && styles.withTutor}
        onLayout={(e) => setTutorSpan(e.nativeEvent.layout.width - TUTOR_SIZE - Spacing.xl * 2)}>
        <Sticker outline={theme.accent} fill={theme.background}>
          <ScrollView
            style={[styles.card, { maxHeight: height - topInset - Spacing.lg * 2 - 4 - (coachAvailable ? TUTOR_OVERHANG : 0) }]}
            contentContainerStyle={styles.cardContent}
            alwaysBounceVertical={false}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.labelRow}>
              <Text style={[Type.label, styles.reviewLabel, { color: theme.accent }]}>Review</Text>
              {coachAvailable && <CreditPill kind="check" />}
            </View>

            {!revealed ? (
              <>
                <Text style={[styles.prompt, { color: theme.text }]}>
                  What does{' '}
                  <Text style={[styles.promptWord, { color: theme.word, backgroundColor: theme.accentSoft }]}>
                    {' '}
                    {word.word}{' '}
                  </Text>{' '}
                  mean?
                </Text>
                <View>
                  <TextInput
                    value={text}
                    onChangeText={setText}
                    placeholder={coachAvailable ? 'Say or type what it means. Add a sentence if you like.' : 'Type what it means…'}
                    placeholderTextColor={theme.textSecondary}
                    multiline
                    maxLength={500}
                    editable={!busy}
                    style={[
                      styles.input,
                      coachAvailable && styles.inputWithMic,
                      { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  />
                  {coachAvailable && (
                    <Pressable
                      onPress={voice.toggle}
                      disabled={voice.state === 'transcribing' || checking}
                      accessibilityLabel={voice.state === 'recording' ? 'Stop recording' : 'Answer by voice'}
                      style={[
                        styles.mic,
                        { backgroundColor: voice.state === 'recording' ? theme.wrong : theme.accent },
                      ]}>
                      {voice.state === 'transcribing' ? (
                        <ActivityIndicator color={theme.background} />
                      ) : (
                        <Ionicons
                          name={voice.state === 'recording' ? 'stop' : 'mic'}
                          size={22}
                          color={theme.background}
                        />
                      )}
                    </Pressable>
                  )}
                </View>
                {voice.state !== 'idle' && (
                  <Text style={[styles.small, { color: voice.state === 'recording' ? theme.wrong : theme.textSecondary }]}>
                    {voice.state === 'recording'
                      ? `Recording… ${voice.seconds}s of 30. Tap to stop.`
                      : 'Transcribing…'}
                  </Text>
                )}
                <View style={styles.row}>
                  <Button
                    label="Reveal"
                    onPress={() => setRevealed(true)}
                    primary={!coachAvailable}
                  />
                  {coachAvailable && (
                    <Button label="Check" onPress={check} primary disabled={!canCheck} loading={checking} />
                  )}
                </View>
                <Text style={[styles.small, styles.center, { color: theme.textSecondary }]}>
                  {checking ? 'Tutor is reading your answer…' : 'Answer or reveal, then rate yourself to keep scrolling.'}
                </Text>
              </>
            ) : (
              <>
                {coach && (
                  <View style={[styles.result, { backgroundColor: theme.surface, borderColor: verdictColor }]}>
                    <View style={styles.verdictRow}>
                      <Ionicons name={VERDICT_ICON[coach.verdict]} size={20} color={verdictColor} />
                      <Text style={[styles.resultTitle, { color: verdictColor }]}>{VERDICT_TITLE[coach.verdict]}</Text>
                    </View>
                    <Text style={[styles.resultText, { color: theme.text }]}>{coach.feedback}</Text>
                    <Example text={coach.improvedSentence} />
                    <Text style={[styles.small, { color: theme.textSecondary }]}>
                      {coach.remainingToday} Tutor {coach.remainingToday === 1 ? 'check' : 'checks'} left today
                    </Text>
                  </View>
                )}
                {fallback && (
                  <View style={[styles.result, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.resultText, { color: theme.text }]}>
                      {fallback === 'limit'
                        ? `You've used today's ${isPremium ? 50 : 3} Tutor checks. Rate yourself instead.`
                        : 'Tutor is offline. Rate yourself instead.'}
                    </Text>
                    {fallback === 'limit' && !isPremium && (
                      <Pressable onPress={showPaywall} hitSlop={8}>
                        <Text style={[styles.link, { color: theme.premium }]}>Get 50 checks a day with Premium</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <WordHeading word={word} />
                <Text style={[Type.body, { color: theme.text }]}>{word.definition}</Text>
                {!coach && <Example text={word.example} word={word} />}
                <Translation word={word} nativeLang={nativeLang} />
                <ExplainLink wordId={word.id} />

                {!next ? (
                  <>
                    <View style={styles.row}>
                      <Button label="Didn't know" onPress={() => rate(false)} />
                      <Button label="Knew it" onPress={() => rate(true)} primary />
                    </View>
                    <Text style={[styles.small, styles.center, { color: theme.textSecondary }]}>
                      Rate yourself to keep scrolling.
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.small, { color: theme.textSecondary }]}>
                    {!coach && (next.correct ? 'Nice. ' : 'No problem. ')}
                    {describeNext(next.state)}
                  </Text>
                )}
              </>
            )}
          </ScrollView>
        </Sticker>
        {/* Tutor sits on top of the card, leaning toward his corner. He moves
            himself between the corners, so he is placed at the left one. */}
        {coachAvailable && tutorSpan !== undefined && (
          <Tutor
            mood={mood}
            size={TUTOR_SIZE}
            side={tutorSide}
            span={tutorSpan}
            visible={active}
            impatient={waiting && waitedLong}
            onWander={flipTutor}
            style={styles.tutor}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Button({
  label,
  onPress,
  primary,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <StickerButton
      label={label}
      onPress={onPress}
      variant={primary ? 'primary' : 'secondary'}
      disabled={disabled}
      loading={loading}
      style={styles.button}
    />
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', padding: Spacing.lg },
  card: { flexGrow: 0 },
  withTutor: { marginTop: TUTOR_OVERHANG },
  tutor: { position: 'absolute', top: -TUTOR_OVERHANG, left: Spacing.xl },
  cardContent: { padding: Spacing.xl, gap: Spacing.lg },
  reviewLabel: { fontWeight: '600' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  prompt: { fontFamily: Fonts.title, fontSize: 26, lineHeight: 34 },
  promptWord: { fontFamily: Fonts.word },
  input: {
    minHeight: 96,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.chip,
    padding: Spacing.md,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  inputWithMic: { paddingRight: 64 },
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
  row: { flexDirection: 'row', gap: Spacing.md },
  button: { flex: 1 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  result: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  resultTitle: { fontSize: 17, fontWeight: '600' },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  resultText: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  center: { textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600' },
});
