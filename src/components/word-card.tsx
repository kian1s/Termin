import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Doodle } from '@/components/doodle-icons';
import { Sticker } from '@/components/sticker';
import { useAppState } from '@/lib/app-state';
import { bestVoice } from '@/lib/voices';
import { CATEGORY_NAMES, FAVORITES_ID, Lang, SPEECH_VOICES, WordEntry } from '@/lib/types';

type Props = {
  word: WordEntry;
  nativeLang: Lang;
  height: number;
  // Replaces the level label, e.g. "Stretch · C1" (SPEC 4.12).
  badge?: string;
};

export function WordCard({ word, nativeLang, height, badge }: Props) {
  const theme = useTheme();
  const { sets, toggleFavorite } = useAppState();
  const favorite = sets.find((s) => s.id === FAVORITES_ID)?.wordIds.includes(word.id);

  const onHeart = () => {
    if (toggleFavorite(word.id)) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.content}>
        <Text style={[Type.label, styles.label, { color: badge ? theme.accent : theme.textSecondary }]}>
          {badge ?? `${word.level} · ${CATEGORY_NAMES[word.category]}`}
        </Text>
        <WordHeading word={word} />
        <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>
        <Example text={word.example} />
        <Translation word={word} nativeLang={nativeLang} />
      </View>

      <View style={styles.actions}>
        <Sticker
          onPress={onHeart}
          radius={ACTION / 2}
          lift={3}
          contentStyle={styles.action}
          accessibilityLabel={favorite ? 'Remove from Favorites' : 'Save to Favorites'}
          accessibilityState={{ selected: !!favorite }}>
          <Doodle name="heart" size={28} filled={!!favorite} />
        </Sticker>
        <Sticker
          onPress={() => router.push({ pathname: '/add-to-set/[wordId]', params: { wordId: word.id } })}
          radius={ACTION / 2}
          lift={3}
          contentStyle={styles.action}
          accessibilityLabel="Add to set">
          <Doodle name="plus" size={28} />
        </Sticker>
      </View>
    </View>
  );
}

// The word in large Fraunces, the speaker button, and the part of speech.
export function WordHeading({ word }: { word: WordEntry }) {
  const theme = useTheme();
  const [speaking, setSpeaking] = useState(false);

  const speak = async () => {
    Speech.stop();
    const voice = await bestVoice(word.lang);
    Speech.speak(word.word, {
      language: SPEECH_VOICES[word.lang],
      voice: voice?.id,
      onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <View style={styles.heading}>
      <View style={styles.wordRow}>
        <Text style={[styles.word, { color: theme.word }]} adjustsFontSizeToFit numberOfLines={2}>
          {word.word}
          {/* Terracotta dot, echoing the "t." app icon. */}
          <Text style={{ color: theme.spark }}>.</Text>
        </Text>
        <Pressable onPress={speak} hitSlop={12} accessibilityLabel="Pronounce">
          <Doodle name="speaker" size={28} color={speaking ? theme.spark : theme.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.pos, { color: theme.textSecondary }]}>{word.partOfSpeech}</Text>
    </View>
  );
}

export function Example({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.example, { borderLeftColor: theme.accent }]}>
      <Text style={[styles.exampleText, { color: theme.text }]}>“{text}”</Text>
    </View>
  );
}

// The native-language block. Blurred until tapped (DESIGN.md 5), except on flashcards.
export function Translation({
  word,
  nativeLang,
  blurred = true,
}: {
  word: WordEntry;
  nativeLang: Lang;
  blurred?: boolean;
}) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);
  const [blurOpacity] = useState(() => new Animated.Value(1));
  const translation = word.translations[nativeLang];
  if (!translation) return null;

  const reveal = () => {
    Animated.timing(blurOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setRevealed(true)
    );
  };

  return (
    <View style={[styles.translation, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[Type.label, styles.langCode, { color: theme.textSecondary }]}>{nativeLang}</Text>
      <View style={styles.translationBody}>
        <Text style={[styles.translationWord, { color: theme.text }]}>{translation.word}</Text>
        <Text style={[styles.translationDef, { color: theme.textSecondary }]}>
          {translation.definition}
        </Text>
      </View>

      {blurred && !revealed && (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={reveal}>
            <BlurView intensity={30} tint={theme.scheme} style={[StyleSheet.absoluteFill, styles.blur]}>
              <Text style={[styles.revealHint, { color: theme.textSecondary }]}>Tap to reveal</Text>
            </BlurView>
          </Pressable>
        </Animated.View>
      )}
    </View>
  );
}

// Size of the round sticker buttons (heart, add to set).
const ACTION = 52;

const styles = StyleSheet.create({
  card: { justifyContent: 'center', paddingHorizontal: Spacing.xl },
  content: { gap: Spacing.lg },
  actions: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
  },
  label: { marginBottom: -6 }, // label sits closer to the word it describes
  heading: { marginBottom: Spacing.xs },
  action: { width: ACTION, height: ACTION, alignItems: 'center', justifyContent: 'center' },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  word: { fontFamily: Fonts.word, fontSize: 44, lineHeight: 54, flexShrink: 1 },
  pos: { fontFamily: Fonts.italic, fontSize: 17, lineHeight: 22 },
  definition: { ...Type.body },
  example: { borderLeftWidth: 2, paddingLeft: Spacing.lg },
  exampleText: { fontFamily: Fonts.italic, fontSize: 18, lineHeight: 26 },
  translation: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginTop: Spacing.sm,
  },
  langCode: { paddingTop: 3 },
  translationBody: { flex: 1, gap: Spacing.xs },
  translationWord: { fontSize: 17, fontWeight: '600' },
  translationDef: { fontSize: 15, lineHeight: 21 },
  blur: { alignItems: 'center', justifyContent: 'center' },
  revealHint: { fontSize: 14, fontWeight: '500' },
});
