import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Doodle, DoodleName } from '@/components/doodle-icons';
import { ExplainLink } from '@/components/explain-link';
import { Sticker } from '@/components/sticker';
import { Example, Translation, WordHeading } from '@/components/word-card';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { STAGES } from '@/lib/progress';
import { CATEGORY_NAMES } from '@/lib/types';
import { wordById } from '@/lib/words';

// The plant that stands for each learning stage (as on Progress).
const STAGE_ICON: DoodleName[] = ['seed', 'sprout', 'plant', 'flower'];

// Sheet from tapping a word in a set: the whole card, translation shown.
// The root is the scroll view itself, since a flex: 1 wrapper collapses in
// iOS form sheets with fixed heights.
export default function WordDetail() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings, reviews } = useAppState();
  const word = wordById(id);
  if (!word || !settings) return null;
  const box = reviews[word.id]?.box ?? 1;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Sticker contentStyle={styles.card}>
        <Text style={[Type.label, { color: theme.textSecondary }]}>
          {word.level} · {CATEGORY_NAMES[word.category]}
        </Text>
        <WordHeading word={word} />
        <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>
        <Example text={word.example} word={word} />
        <Translation word={word} nativeLang={settings.nativeLang} blurred={false} />
        <View style={styles.foot}>
          <ExplainLink wordId={word.id} />
          <View style={styles.stage} accessibilityLabel={`Stage: ${STAGES[box - 1]}`}>
            <Doodle name={STAGE_ICON[box - 1]} size={20} />
            <Text style={[styles.stageText, { color: theme.textSecondary }]}>{STAGES[box - 1]}</Text>
          </View>
        </View>
      </Sticker>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  card: { padding: Spacing.xl, gap: Spacing.lg },
  definition: { fontSize: 17, lineHeight: 24 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  stage: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stageText: { fontSize: 15 },
});
