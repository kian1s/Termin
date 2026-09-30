import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Doodle } from '@/components/doodle-icons';
import { Row, Section } from '@/components/grouped-list';
import { PremiumBadge } from '@/components/pro-cards';
import { Sticker } from '@/components/sticker';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { usePremium } from '@/lib/premium';
import { FAVORITES_ID, WordEntry } from '@/lib/types';
import { wordById } from '@/lib/words';

// One set's words, with remove, rename and delete.
export default function SetScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sets, removeFromSet, deleteSet } = useAppState();
  const { isPremium, showPaywall } = usePremium();
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

      {/* SPEC 4.15: Premium flashcards. Free users see it in Premium colors and get the paywall. */}
      <View style={styles.study}>
        <Sticker
          onPress={() =>
            isPremium ? router.push({ pathname: '/flashcards/[setId]', params: { setId: set.id } }) : showPaywall()
          }
          disabled={words.length === 0}
          radius={Radius.chip}
          fill={isPremium ? theme.accent : theme.premiumSoft}
          outline={isPremium ? theme.text : theme.premium}
          style={words.length === 0 && styles.dim}
          contentStyle={styles.studyButton}>
          <Ionicons name="layers-outline" size={20} color={isPremium ? theme.background : theme.premium} />
          <Text style={[styles.studyText, { color: isPremium ? theme.background : theme.premium }]}>
            Study flashcards
          </Text>
          {!isPremium && <PremiumBadge lock />}
        </Sticker>
        {words.length === 0 && (
          <Text style={[styles.studyHint, { color: theme.textSecondary }]}>Add words to this set to study them.</Text>
        )}
      </View>

      <Section>
        <Row
          label="Add a word"
          icon={<Doodle name="plus" size={22} />}
          onPress={() => router.push({ pathname: '/add-word', params: { setId: set.id } })}
          last={words.length === 0}
        />
        {words.length === 0 ? null : (
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
  study: { gap: Spacing.sm },
  studyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  dim: { opacity: 0.4 },
  studyText: { fontSize: 17, fontWeight: '600' },
  studyHint: { fontSize: 14, paddingHorizontal: Spacing.xs },
});
