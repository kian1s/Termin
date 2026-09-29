import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
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

import { Example, Translation, WordHeading } from '@/components/word-card';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { checkAnswer, coachAvailable, CoachResult } from '@/lib/coach';
import { usePremium } from '@/lib/premium';
import { describeNext } from '@/lib/progress';
import { useVoiceAnswer } from '@/lib/voice';
import { coachFeedbackLang, Lang, ReviewState, WordEntry } from '@/lib/types';

// `onFinished` fires once the card is checked or revealed, unlocking the feed.
type Props = { word: WordEntry; nativeLang: Lang; height: number; onFinished: () => void };

// Why the card fell back to Reveal and self-rating instead of the AI Coach.
type Fallback = 'limit' | 'network' | null;

const VERDICT_TITLE = { correct: 'Correct', partly: 'Partly right', incorrect: 'Not quite' };

// A saved word coming back as a question (SPEC 4.4). With the AI Coach the
// answer is graded (SPEC 4.5); otherwise the user reveals and rates themselves.
export function ReviewCard({ word, nativeLang, height, onFinished }: Props) {
  const theme = useTheme();
  const { answer, settings } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [coach, setCoach] = useState<CoachResult | null>(null);
  const [fallback, setFallback] = useState<Fallback>(null);
  const [revealed, setRevealed] = useState(false);
  const [next, setNext] = useState<{ correct: boolean; state: ReviewState } | null>(null);

  // Voice answers fill the text box, so the user can edit before checking.
  const voice = useVoiceAnswer(word, (spoken) => setText((t) => (t.trim() ? `${t.trim()} ${spoken}` : spoken)));
  const busy = checking || voice.state !== 'idle';

  const rate = (correct: boolean) => setNext({ correct, state: answer(word.id, correct) });

  const check = async () => {
    setChecking(true);
    const feedbackLang = settings ? coachFeedbackLang(settings) : nativeLang;
    const result = await checkAnswer(word, text.trim(), nativeLang, feedbackLang, isPremium);
    setChecking(false);
    if (typeof result === 'string') {
      setFallback(result);
      setRevealed(true);
      onFinished();
      return;
    }
    setCoach(result);
    setRevealed(true);
    onFinished();
    // A "partly" verdict counts as correct for the Leitner schedule.
    rate(result.verdict !== 'incorrect');
  };

  const canCheck = coachAvailable && text.trim().length > 0 && !busy;
  const verdictColor = coach
    ? { correct: theme.correct, partly: theme.partly, incorrect: theme.wrong }[coach.verdict]
    : theme.border;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.page, { height }]}>
      {/* Scrolls inside itself when the Coach's answer makes it taller than the screen. */}
      <ScrollView
        style={[styles.card, { borderColor: theme.accent, maxHeight: height - Spacing.lg * 2 }]}
        contentContainerStyle={styles.cardContent}
        alwaysBounceVertical={false}
        bounces={false}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={[Type.label, styles.reviewLabel, { color: theme.accent }]}>Review</Text>

        {!revealed ? (
          <>
            <Text style={[styles.prompt, { color: theme.text }]}>
              What does <Text style={styles.promptWord}>{word.word}</Text> mean? Use it in a
              sentence.
            </Text>
            <View>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={coachAvailable ? 'Type or speak your answer…' : 'Type your answer…'}
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
                onPress={() => {
                  setRevealed(true);
                  onFinished();
                }}
                primary={!coachAvailable}
              />
              {coachAvailable && (
                <Button label="Check" onPress={check} primary disabled={!canCheck} loading={checking} />
              )}
            </View>
            <Text style={[styles.small, styles.center, { color: theme.textSecondary }]}>
              Answer or reveal to keep scrolling.
            </Text>
          </>
        ) : (
          <>
            {coach && (
              <View style={[styles.result, { backgroundColor: theme.surface, borderColor: verdictColor }]}>
                <Text style={[styles.resultTitle, { color: verdictColor }]}>{VERDICT_TITLE[coach.verdict]}</Text>
                <Text style={[styles.resultText, { color: theme.text }]}>{coach.feedback}</Text>
                <Example text={coach.improvedSentence} />
                <Text style={[styles.small, { color: theme.textSecondary }]}>
                  {coach.remainingToday} AI {coach.remainingToday === 1 ? 'check' : 'checks'} left today
                </Text>
              </View>
            )}
            {fallback && (
              <View style={[styles.result, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={[styles.resultText, { color: theme.text }]}>
                  {fallback === 'limit'
                    ? `You've used today's ${isPremium ? 50 : 3} AI checks. Rate yourself instead.`
                    : 'The AI Coach is offline. Rate yourself instead.'}
                </Text>
                {fallback === 'limit' && !isPremium && (
                  <Pressable onPress={showPaywall} hitSlop={8}>
                    <Text style={[styles.link, { color: theme.accent }]}>Get 50 checks a day with Premium</Text>
                  </Pressable>
                )}
              </View>
            )}

            <WordHeading word={word} />
            <Text style={[Type.body, { color: theme.text }]}>{word.definition}</Text>
            {!coach && <Example text={word.example} />}
            <Translation word={word} nativeLang={nativeLang} />

            {!next ? (
              <View style={styles.row}>
                <Button label="Didn't" onPress={() => rate(false)} />
                <Button label="Knew it" onPress={() => rate(true)} primary />
              </View>
            ) : (
              <Text style={[styles.small, { color: theme.textSecondary }]}>
                {!coach && (next.correct ? 'Nice. ' : 'No problem. ')}
                {describeNext(next.state)}
              </Text>
            )}
          </>
        )}
      </ScrollView>
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
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
        (pressed || disabled) && { opacity: disabled && !loading ? 0.4 : 0.8 },
      ]}>
      {loading ? (
        <ActivityIndicator color={primary ? theme.background : theme.text} />
      ) : (
        <Text style={[styles.buttonText, { color: primary ? theme.background : theme.text }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', padding: Spacing.lg },
  card: {
    flexGrow: 0,
    borderWidth: 1,
    borderRadius: Radius.card,
  },
  cardContent: { padding: Spacing.xl, gap: Spacing.lg },
  reviewLabel: { fontWeight: '600' },
  prompt: { fontFamily: Fonts.title, fontSize: 26, lineHeight: 34 },
  promptWord: { fontFamily: Fonts.italic },
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
  button: {
    flex: 1,
    borderRadius: Radius.chip,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
  result: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: Spacing.sm },
  resultTitle: { fontSize: 17, fontWeight: '600' },
  resultText: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  center: { textAlign: 'center' },
  link: { fontSize: 15, fontWeight: '600' },
});
