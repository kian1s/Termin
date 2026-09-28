import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { CATEGORY_NAMES, Lang, SPEECH_VOICES, WordEntry } from '@/lib/types';

type Props = {
  word: WordEntry;
  nativeLang: Lang;
  translationHidden: boolean;
  height: number;
};

export function WordCard({ word, nativeLang, translationHidden, height }: Props) {
  const theme = useTheme();
  const [speaking, setSpeaking] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [blurOpacity] = useState(() => new Animated.Value(1));
  const translation = word.translations[nativeLang];

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

  const reveal = () => {
    Animated.timing(blurOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setRevealed(true)
    );
  };

  return (
    <View style={[styles.card, { height }]}>
      <Text style={[Type.label, { color: theme.textSecondary }]}>
        {word.level} · {CATEGORY_NAMES[word.category]}
      </Text>

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

      <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>

      <View style={[styles.example, { borderLeftColor: theme.accent }]}>
        <Text style={[styles.exampleText, { color: theme.text }]}>“{word.example}”</Text>
      </View>

      {translation && (
        <View
          style={[styles.translation, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[Type.label, styles.langCode, { color: theme.textSecondary }]}>
            {nativeLang}
          </Text>
          <View style={styles.translationBody}>
            <Text style={[styles.translationWord, { color: theme.text }]}>{translation.word}</Text>
            <Text style={[styles.translationDef, { color: theme.textSecondary }]}>
              {translation.definition}
            </Text>
          </View>

          {translationHidden && !revealed && (
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: blurOpacity }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={reveal}>
                <BlurView
                  intensity={30}
                  tint={theme.scheme}
                  style={[StyleSheet.absoluteFill, styles.blur]}>
                  <Text style={[styles.revealHint, { color: theme.textSecondary }]}>
                    Tap to reveal
                  </Text>
                </BlurView>
              </Pressable>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.lg },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: -Spacing.md },
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
