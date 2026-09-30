import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Row, Section } from '@/components/grouped-list';
import { StickerButton } from '@/components/sticker';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { LANG_NAMES, WordEntry } from '@/lib/types';
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

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={[styles.title, { color: theme.text }]}>Add to “{set.name}”</Text>
        {candidates.length === 0 ? (
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            All your saved words are already in this set.
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
      {candidates.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md, borderTopColor: theme.border }]}>
          <StickerButton
            label={picked.size ? `Add ${picked.size} ${picked.size === 1 ? 'word' : 'words'}` : 'Add'}
            onPress={add}
            disabled={!picked.size}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: Spacing.lg, paddingTop: Spacing.xl, gap: Spacing.lg },
  title: { fontFamily: Fonts.title, fontSize: 24, paddingHorizontal: Spacing.xs },
  hint: { fontSize: 15, lineHeight: 21, paddingHorizontal: Spacing.xs },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.chip, padding: Spacing.md, fontSize: 17 },
  footer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
});
