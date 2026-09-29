import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buildTest, QUESTIONS_PER_LEVEL, scoreTest } from '@/lib/level-test';
import { Lang, Level } from '@/lib/types';

const DONT_KNOW = "I don't know";
const FEEDBACK_MS = 600;

type Props = {
  lang: Lang;
  // The level to keep instead; without one the button reads "Choose myself".
  currentLevel?: Level;
  onUse: (level: Level) => void;
  onKeep: () => void;
};

// SPEC 4.14: 12 questions, one word and 4 definitions each, no going back.
// Test words are not marked as seen.
export function LevelTest({ lang, currentLevel, onUse, onKeep }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [questions] = useState(() => buildTest(lang));
  const [results, setResults] = useState<boolean[]>([]);
  const [picked, setPicked] = useState<string | null>(null);

  const index = results.length;
  const done = index >= questions.length;

  // Show right or wrong briefly, then move on.
  useEffect(() => {
    if (picked === null) return;
    const q = questions[index];
    const timer = setTimeout(() => {
      setResults((r) => [...r, picked === q.answer]);
      setPicked(null);
    }, FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [picked, index, questions]);

  if (done) {
    const { scores, suggested } = scoreTest(results);
    const same = suggested === currentLevel;
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={[styles.result, { paddingTop: insets.top + Spacing.xxl, paddingBottom: insets.bottom + Spacing.xl }]}>
        <Text style={[Type.label, { color: theme.textSecondary }]}>Level test</Text>
        <Text style={[styles.resultTitle, { color: theme.text }]}>
          Your level: <Text style={{ color: theme.word }}>{suggested}</Text>
        </Text>
        <Text style={[styles.explain, { color: theme.textSecondary }]}>
          {suggested === 'B1'
            ? 'Start at B1 and let the app stretch you as you improve.'
            : `You knew most words up to ${suggested}, so its words should challenge you without overwhelming you.`}
        </Text>
        <View style={[styles.scores, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {scores.map((s) => (
            <View key={s.level} style={styles.scoreRow}>
              <Text style={[styles.scoreLevel, { color: theme.text }]}>{s.level}</Text>
              <Text style={[styles.scoreValue, { color: theme.textSecondary }]}>
                {s.correct}/{QUESTIONS_PER_LEVEL}
              </Text>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => onUse(suggested)}
          style={({ pressed }) => [styles.button, { backgroundColor: theme.accent, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={[styles.buttonText, { color: theme.background }]}>Use {suggested}</Text>
        </Pressable>
        {!same && (
          <Pressable onPress={onKeep} hitSlop={8} style={styles.textButton}>
            <Text style={[styles.textButtonText, { color: theme.accent }]}>
              {currentLevel ? `Keep ${currentLevel}` : 'Choose myself'}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    );
  }

  const q = questions[index];
  const options = [...q.options, DONT_KNOW];
  const progress = index / questions.length;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + Spacing.md }]}>
      <View style={styles.top}>
        <View style={[styles.track, { backgroundColor: theme.border }]}>
          <View style={[styles.fill, { backgroundColor: theme.accent, width: `${progress * 100}%` }]} />
        </View>
        <Pressable onPress={onKeep} hitSlop={10} accessibilityLabel="Close the level test">
          <Ionicons name="close" size={24} color={theme.textSecondary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Text style={[Type.label, { color: theme.textSecondary }]}>
          {index + 1} of {questions.length} · What does it mean?
        </Text>
        <Text style={[styles.word, { color: theme.word }]} adjustsFontSizeToFit numberOfLines={2}>
          {q.word.word}
          <Text style={{ color: theme.spark }}>.</Text>
        </Text>
        <View style={styles.options}>
          {options.map((o) => {
            const chosen = picked === o;
            const isAnswer = o === q.answer;
            // After a pick: the right answer turns "correct", a wrong pick turns "wrong".
            const border =
              picked === null ? theme.border : isAnswer ? theme.correct : chosen ? theme.wrong : theme.border;
            const icon = picked !== null && (isAnswer ? 'checkmark-circle' : chosen ? 'close-circle' : null);
            return (
              <Pressable
                key={o}
                onPress={() => setPicked(o)}
                disabled={picked !== null}
                style={[styles.option, { backgroundColor: theme.surface, borderColor: border }]}
                accessibilityRole="button">
                <Text
                  style={[
                    styles.optionText,
                    { color: o === DONT_KNOW ? theme.textSecondary : theme.text },
                    o === DONT_KNOW && styles.dontKnow,
                  ]}>
                  {o}
                </Text>
                {icon && <Ionicons name={icon} size={20} color={isAnswer ? theme.correct : theme.wrong} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4 },
  content: { paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl, gap: Spacing.lg },
  word: { fontFamily: Fonts.word, fontSize: 40, lineHeight: 50 },
  options: { gap: Spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1.5,
    borderRadius: Radius.chip,
    padding: Spacing.lg,
  },
  optionText: { flex: 1, fontSize: 16, lineHeight: 22 },
  dontKnow: { fontStyle: 'italic' },
  result: { paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  resultTitle: { fontFamily: Fonts.title, fontSize: 32, lineHeight: 40 },
  explain: { fontSize: 16, lineHeight: 22 },
  scores: { borderRadius: Radius.card, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.sm },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scoreLevel: { fontSize: 16, fontWeight: '600' },
  scoreValue: { fontSize: 16 },
  button: { borderRadius: Radius.chip, paddingVertical: Spacing.lg, alignItems: 'center', marginTop: Spacing.md },
  buttonText: { fontSize: 17, fontWeight: '600' },
  textButton: { alignSelf: 'center', padding: Spacing.sm },
  textButtonText: { fontSize: 17, fontWeight: '600' },
});
