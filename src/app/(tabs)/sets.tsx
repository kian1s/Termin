import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Doodle } from '@/components/doodle-icons';
import { Row, Section } from '@/components/grouped-list';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { FREE_CUSTOM_SETS } from '@/lib/gating';
import { usePremium } from '@/lib/premium';
import { FAVORITES_ID, WordSet } from '@/lib/types';

function wordCount(set: WordSet) {
  return `${set.wordIds.length} ${set.wordIds.length === 1 ? 'word' : 'words'}`;
}

export default function SetsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { sets } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const favorites = sets.find((s) => s.id === FAVORITES_ID)!;
  const custom = sets.filter((s) => s.id !== FAVORITES_ID);
  const open = (id: string) => router.push({ pathname: '/set/[id]', params: { id } });

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.lg }]}>
      <Text style={[styles.title, { color: theme.text }]}>Sets</Text>

      <Section>
        <Row
          label="Favorites"
          icon={<Doodle name="heart" size={22} filled />}
          value={wordCount(favorites)}
          onPress={() => open(FAVORITES_ID)}
          last
        />
      </Section>

      <Section title="Add words">
        <Row
          label="Words from a text"
          subtitle="A link, a photo of a page, or text"
          icon={<Doodle name="book" size={22} />}
          onPress={() => router.push('/from-text')}
          last
        />
      </Section>

      <Section
        title="Your sets"
        footer={
          isPremium
            ? 'Group words by purpose, like “Debate” or “Essay on climate”.'
            : `Free includes ${FREE_CUSTOM_SETS} sets of your own. Premium makes them unlimited.`
        }>
        {custom.map((set) => (
          <Row
            key={set.id}
            label={set.name}
            icon={<Ionicons name="albums-outline" size={20} color={theme.textSecondary} />}
            value={wordCount(set)}
            onPress={() => open(set.id)}
          />
        ))}
        <Row
          label="New set"
          icon={<Doodle name="plus" size={22} />}
          onPress={() =>
            !isPremium && custom.length >= FREE_CUSTOM_SETS ? showPaywall() : router.push('/set-name')
          }
          chevron={false}
          last
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.xl },
  title: { fontFamily: Fonts.title, fontSize: 28, paddingHorizontal: Spacing.xs },
});
