import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Doodle } from '@/components/doodle-icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Opens the Explain it differently sheet for a card (SPEC 4.21). Feed cards use
// a round sticker button instead (word-card.tsx).
export function openExplain(wordId: string) {
  router.push({ pathname: '/explain/[wordId]', params: { wordId } });
}

export function ExplainLink({ wordId }: { wordId: string }) {
  const theme = useTheme();
  return (
    <Pressable onPress={() => openExplain(wordId)} hitSlop={8} accessibilityRole="button" style={styles.link}>
      <Doodle name="bulb" size={20} color={theme.accent} />
      <Text style={[styles.text, { color: theme.accent }]}>Explain it differently</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  text: { fontSize: 15, fontWeight: '600' },
});
