import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { StickerButton } from '@/components/sticker';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';

// Sheet for naming a set. With `setId` it renames; otherwise it creates a new
// set, adding `wordId` to it if given.
export default function SetName() {
  const theme = useTheme();
  const { setId, wordId } = useLocalSearchParams<{ setId?: string; wordId?: string }>();
  const { sets, createSet, renameSet } = useAppState();
  const existing = sets.find((s) => s.id === setId);
  const [name, setName] = useState(existing?.name ?? '');
  const trimmed = name.trim();

  const save = () => {
    if (!trimmed) return;
    if (existing) renameSet(existing.id, trimmed);
    else createSet(trimmed, wordId);
    router.back();
  };

  return (
    <View style={styles.content}>
      <Text style={[styles.title, { color: theme.text }]}>
        {existing ? 'Rename set' : 'New set'}
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Debate club"
        placeholderTextColor={theme.textSecondary}
        autoFocus
        maxLength={40}
        returnKeyType="done"
        onSubmitEditing={save}
        style={[
          styles.input,
          { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      />
      <StickerButton label={existing ? 'Save' : 'Create set'} onPress={save} disabled={!trimmed} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.xl, gap: Spacing.lg },
  title: { fontFamily: Fonts.title, fontSize: 24 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.chip,
    padding: Spacing.lg,
    fontSize: 17,
  },
  button: { borderRadius: Radius.chip, paddingVertical: Spacing.lg, alignItems: 'center' },
  buttonText: { fontSize: 17, fontWeight: '600' },
});
