import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { Sticker, StickerButton } from '@/components/sticker';
import { Fonts, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ExplainMode, explainWord } from '@/lib/coach';
import { setCreditLeft, useCredit } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { wordById } from '@/lib/words';

const TITLES: Record<ExplainMode, string> = { simpler: 'In simple words', example: 'Another example' };

// SPEC 4.21: a sheet with an easier explanation or another example for one
// card. Free: 1 a day; Premium: 30 a day.
export default function Explain() {
  const theme = useTheme();
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const word = wordById(wordId);
  const { isPremium, showPaywall } = usePremium();
  const credit = useCredit('explain');
  const [loading, setLoading] = useState<ExplainMode | null>(null);
  const [answer, setAnswer] = useState<{ mode: ExplainMode; text: string } | null>(null);
  const [problem, setProblem] = useState<'limit' | 'network' | null>(null);

  if (!word) return null;
  const outOfUses = problem === 'limit' || credit?.left === 0;

  const ask = async (mode: ExplainMode) => {
    setLoading(mode);
    setProblem(null);
    const out = await explainWord(word, mode, isPremium);
    setLoading(null);
    if (out === 'limit') setCreditLeft('explain', 0);
    if (typeof out === 'string') {
      setProblem(out);
      return;
    }
    setCreditLeft('explain', out.remaining);
    setAnswer({ mode, text: out.text });
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.head}>
        <Text style={[styles.word, { color: theme.word }]} numberOfLines={2}>
          {word.word}
          <Text style={{ color: theme.spark }}>.</Text>
        </Text>
        <CreditPill kind="explain" />
      </View>

      {outOfUses ? (
        <View style={styles.block}>
          <Text style={[styles.body, { color: theme.text }]}>
            {isPremium
              ? "You've used today's 30 explanations. More tomorrow."
              : "You've used today's free explanation. Premium gets 30 a day."}
          </Text>
          {!isPremium && <StickerButton label="See Premium" variant="premium" onPress={showPaywall} />}
        </View>
      ) : (
        <View style={styles.row}>
          <StickerButton
            label="Easier"
            onPress={() => ask('simpler')}
            loading={loading === 'simpler'}
            disabled={!!loading}
            style={styles.flex}
          />
          <StickerButton
            label="Another example"
            variant="secondary"
            onPress={() => ask('example')}
            loading={loading === 'example'}
            disabled={!!loading}
            style={styles.flex}
          />
        </View>
      )}

      {problem === 'network' && (
        <Text style={[styles.small, { color: theme.textSecondary }]}>
          Could not reach Termin. Check your connection and try again.
        </Text>
      )}

      {answer && (
        <Sticker outline={theme.accent} contentStyle={styles.answer}>
          <Text style={[Type.label, { color: theme.accent }]}>{TITLES[answer.mode]}</Text>
          <Text style={[answer.mode === 'example' ? styles.example : styles.body, { color: theme.text }]}>
            {answer.mode === 'example' ? `“${answer.text}”` : answer.text}
          </Text>
        </Sticker>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, gap: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  word: { fontFamily: Fonts.word, fontSize: 32, lineHeight: 40, flexShrink: 1 },
  row: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1 },
  block: { gap: Spacing.md },
  answer: { padding: Spacing.lg, gap: Spacing.sm },
  body: { fontSize: 17, lineHeight: 24 },
  example: { fontFamily: Fonts.italic, fontSize: 18, lineHeight: 26 },
  small: { fontSize: 13, lineHeight: 18 },
});
