import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Row, Section } from '@/components/grouped-list';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { FAVORITES_ID } from '@/lib/types';
import { wordById } from '@/lib/words';

// Bottom sheet from the "+" on a word card: tap a set to add or remove the word.
export default function AddToSet() {
  const theme = useTheme();
  const { wordId } = useLocalSearchParams<{ wordId: string }>();
  const { sets, addToSet, removeFromSet } = useAppState();
  const word = wordById(wordId);
  if (!word) return null;

  const toggle = (setId: string, inSet: boolean) => {
    if (inSet) return removeFromSet(setId, wordId);
    addToSet(setId, wordId);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>Add “{word.word}” to…</Text>
      <Section>
        <Row
          label="New set"
          icon={<Ionicons name="add" size={22} color={theme.accent} />}
          onPress={() => router.replace({ pathname: '/set-name', params: { wordId } })}
          chevron={false}
          last={sets.length === 0}
        />
        {sets.map((set, i) => {
          const inSet = set.wordIds.includes(wordId);
          return (
            <Row
              key={set.id}
              label={set.name}
              icon={
                set.id === FAVORITES_ID ? (
                  <Ionicons name="heart" size={20} color={theme.accent} />
                ) : (
                  <Ionicons name="albums-outline" size={20} color={theme.textSecondary} />
                )
              }
              onPress={() => toggle(set.id, inSet)}
              chevron={false}
              right={
                inSet ? <Ionicons name="checkmark" size={22} color={theme.accent} /> : undefined
              }
              last={i === sets.length - 1}
            />
          );
        })}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.lg },
  title: { fontFamily: Fonts.title, fontSize: 24, paddingHorizontal: Spacing.xs },
});
