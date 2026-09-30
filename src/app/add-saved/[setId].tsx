import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row, Section } from '@/components/grouped-list';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { FAVORITES_ID, LANG_NAMES, WordEntry } from '@/lib/types';
import { wordById } from '@/lib/words';

// Sheet from a set's "Add saved words": every word saved in any other set
// that isn't in this one yet. Tick several, then add them in one go.
export default function AddSaved() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { sets, savedIds, settings, addToSet } = useAppState();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const set = sets.find((s) => s.id === setId);
  if (!set || !settings) return null;

  // Learning language first, then alphabetical.
  const candidates = [...savedIds]
    .filter((id) => !set.wordIds.includes(id))
    .map((id) => wordById(id))
    .filter((w): w is WordEntry => !!w)
    .sort(
      (a, b) =>
        Number(b.lang === settings.learningLang) - Number(a.lang === settings.learningLang) ||
        a.word.localeCompare(b.word)
    );
  const q = query.trim().toLowerCase();
  const shown = q
    ? candidates.filter((w) => w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q))
    : candidates;
  const manyLangs = new Set(candidates.map((w) => w.lang)).size > 1;

  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const add = () => {
    picked.forEach((id) => addToSet(set.id, id));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  // The sheet is the scroll view itself: a flex: 1 wrapper collapses inside
  // iOS form sheets with fixed heights, which hid the list.
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag">
      <View style={styles.head}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          Add to “{set.name}”
        </Text>
        {candidates.length > 0 && (
          <Pressable onPress={add} disabled={!picked.size} hitSlop={10} accessibilityRole="button">
            <Text style={[styles.addText, { color: picked.size ? theme.accent : theme.border }]}>
              {picked.size ? `Add ${picked.size}` : 'Add'}
            </Text>
          </Pressable>
        )}
      </View>
      {candidates.length === 0 ? (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          {set.id === FAVORITES_ID
            ? 'Every saved word is already in Favorites. Words you add to your other sets will show up here.'
            : 'Every saved word is already in this set. Tap the heart on a card in the feed to save more.'}
        </Text>
      ) : (
        <>
          {candidates.length > 8 && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[styles.search, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
            />
          )}
          <Section>
            {shown.length === 0 && <Row label="No matches" last />}
            {shown.map((w, i) => {
              const on = picked.has(w.id);
              return (
                <Row
                  key={w.id}
                  label={manyLangs ? `${w.word} · ${LANG_NAMES[w.lang]}` : w.word}
                  subtitle={w.definition}
                  onPress={() => toggle(w.id)}
                  chevron={false}
                  right={
                    <Ionicons
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={24}
                      color={on ? theme.accent : theme.border}
                    />
                  }
                  last={i === shown.length - 1}
                />
              );
            })}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.lg },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xs },
  title: { fontFamily: Fonts.title, fontSize: 24, flex: 1 },
  addText: { fontSize: 17, fontWeight: '700' },
  hint: { fontSize: 15, lineHeight: 21, paddingHorizontal: Spacing.xs },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.chip, padding: Spacing.md, fontSize: 17 },
});
