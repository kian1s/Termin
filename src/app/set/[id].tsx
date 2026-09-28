import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { Row, Section } from '@/components/grouped-list';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { FAVORITES_ID, WordEntry } from '@/lib/types';
import { wordById } from '@/lib/words';

// One set's words, with remove, rename and delete.
export default function SetScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sets, removeFromSet, deleteSet } = useAppState();
  const set = sets.find((s) => s.id === id);
  if (!set) return null;

  const words = set.wordIds.map(wordById).filter((w): w is WordEntry => !!w);
  const isFavorites = set.id === FAVORITES_ID;

  const confirmDelete = () =>
    Alert.alert(`Delete “${set.name}”?`, 'The words stay saved in your other sets.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteSet(set.id);
        },
      },
    ]);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>{set.name}</Text>

      <Section>
        {words.length === 0 ? (
          <Row label="No words yet" subtitle="Tap ♡ or + on a card in the feed to add one." last />
        ) : (
          words.map((w, i) => (
            <Row
              key={w.id}
              label={w.word}
              subtitle={w.definition}
              last={i === words.length - 1}
              right={
                <Pressable
                  onPress={() => removeFromSet(set.id, w.id)}
                  hitSlop={10}
                  accessibilityLabel={`Remove ${w.word}`}>
                  <Ionicons name="remove-circle-outline" size={22} color={theme.wrong} />
                </Pressable>
              }
            />
          ))
        )}
      </Section>

      {!isFavorites && (
        <Section>
          <Row
            label="Rename set"
            onPress={() => router.push({ pathname: '/set-name', params: { setId: set.id } })}
          />
          <Row label="Delete set" destructive onPress={confirmDelete} last />
        </Section>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  title: { fontFamily: Fonts.title, fontSize: 28, paddingHorizontal: Spacing.xs },
});
