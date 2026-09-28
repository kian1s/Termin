import { useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { describeNext } from '@/lib/progress';
import { Lang, ReviewState, WordEntry } from '@/lib/types';

type Props = { word: WordEntry; nativeLang: Lang; height: number };

// A saved word coming back as a question (SPEC 4.4). Until the AI Coach exists,
// the user reveals the answer and rates themselves.
export function ReviewCard({ word, nativeLang, height }: Props) {
  const theme = useTheme();
  const { answer } = useAppState();
  const [text, setText] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<{ correct: boolean; next: ReviewState } | null>(null);

  const rate = (correct: boolean) => setResult({ correct, next: answer(word.id, correct) });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.page, { height }]}>
      <View style={[styles.card, { borderColor: theme.accent }]}>
        <Text style={[Type.label, styles.reviewLabel, { color: theme.accent }]}>Review</Text>

        {!revealed ? (
          <>
            <Text style={[styles.prompt, { color: theme.text }]}>
              What does <Text style={styles.promptWord}>{word.word}</Text> mean? Use it in a
              sentence.
            </Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type your answer…"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={500}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            />
            <Button label="Reveal" onPress={() => setRevealed(true)} primary />
          </>
        ) : (
          <>
            <WordHeading word={word} />
            <Text style={[Type.body, { color: theme.text }]}>{word.definition}</Text>
            <Example text={word.example} />
            <Translation word={word} nativeLang={nativeLang} hidden={false} />

            {!result ? (
              <View style={styles.row}>
                <Button label="Didn't" onPress={() => rate(false)} />
                <Button label="Knew it" onPress={() => rate(true)} primary />
              </View>
            ) : (
              <View
                style={[
                  styles.result,
                  {
                    backgroundColor: theme.surface,
                    borderColor: result.correct ? theme.correct : theme.wrong,
                  },
                ]}>
                <Text style={[styles.resultTitle, { color: result.correct ? theme.correct : theme.wrong }]}>
                  {result.correct ? 'Nice.' : 'No problem.'}
                </Text>
                <Text style={[styles.resultText, { color: theme.textSecondary }]}>
                  {describeNext(result.next)}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function Button({ label, onPress, primary }: { label: string; onPress: () => void; primary?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: theme.accent }
          : { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 },
        pressed && { opacity: 0.8 },
      ]}>
      <Text style={[styles.buttonText, { color: primary ? theme.background : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { justifyContent: 'center', padding: Spacing.lg },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
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
  row: { flexDirection: 'row', gap: Spacing.md },
  button: {
    flex: 1,
    borderRadius: Radius.chip,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  buttonText: { fontSize: 17, fontWeight: '600' },
  result: { borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: Spacing.xs },
  resultTitle: { fontSize: 17, fontWeight: '600' },
  resultText: { fontSize: 15, lineHeight: 21 },
});
