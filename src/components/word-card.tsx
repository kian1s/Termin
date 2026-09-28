import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { CATEGORY_NAMES, FAVORITES_ID, Lang, SPEECH_VOICES, WordEntry } from '@/lib/types';

type Props = {
  word: WordEntry;
  nativeLang: Lang;
  translationHidden: boolean;
  height: number;
};

export function WordCard({ word, nativeLang, translationHidden, height }: Props) {
  const theme = useTheme();
  const { sets, toggleFavorite } = useAppState();
  const favorite = sets.find((s) => s.id === FAVORITES_ID)?.wordIds.includes(word.id);

  const onHeart = () => {
    if (toggleFavorite(word.id)) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.content}>
        <Text style={[Type.label, { color: theme.textSecondary }]}>
          {word.level} · {CATEGORY_NAMES[word.category]}
        </Text>
        <WordHeading word={word} />
        <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>
        <Example text={word.example} />
        <Translation word={word} nativeLang={nativeLang} hidden={translationHidden} />
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onHeart} hitSlop={10} accessibilityLabel="Save to Favorites">
          <Ionicons
            name={favorite ? 'heart' : 'heart-outline'}
            size={30}
            color={favorite ? theme.accent : theme.textSecondary}
          />
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/add-to-set/[wordId]', params: { wordId: word.id } })}
          hitSlop={10}
          accessibilityLabel="Add to set">
          <Ionicons name="add" size={32} color={theme.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

// The word in large Fraunces, the speaker button, and the part of speech.
export function WordHeading({ word }: { word: WordEntry }) {
  const theme = useTheme();
  const [speaking, setSpeaking] = useState(false);

  const speak = () => {
    Speech.stop();
    Speech.speak(word.word, {
      language: SPEECH_VOICES[word.lang],
      onStart: () => setSpeaking(true),
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <View>
      <View style={styles.wordRow}>
        <Text style={[styles.word, { color: theme.text }]} adjustsFontSizeToFit numberOfLines={2}>
          {word.word}
        </Text>
        <Pressable onPress={speak} hitSlop={12} accessibilityLabel="Pronounce">
          <Ionicons
            name="volume-medium-outline"
            size={26}
            color={speaking ? theme.accent : theme.textSecondary}
          />
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

// The native-language block. When `hidden`, it is blurred until tapped.
export function Translation({
  word,
  nativeLang,
  hidden,
}: {
  word: WordEntry;
  nativeLang: Lang;
  hidden: boolean;
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

      {hidden && !revealed && (
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
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  word: { fontFamily: Fonts.word, fontSize: 44, lineHeight: 54, flexShrink: 1 },
  pos: { fontSize: 16, fontStyle: 'italic' },
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
