import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Doodle } from '@/components/doodle-icons';
import { openExplain } from '@/components/explain-link';
import { Sticker } from '@/components/sticker';
import { useAppState } from '@/lib/app-state';
import { pronounce } from '@/lib/pronounce';
import { CATEGORY_NAMES, FAVORITES_ID, Lang, WordEntry } from '@/lib/types';

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
        <Example text={word.example} word={word} />
        <Translation word={word} nativeLang={nativeLang} />
      </View>

      <View style={styles.actions}>
        <Sticker
          onPress={() => openExplain(word.id)}
          radius={ACTION / 2}
          lift={3}
          contentStyle={styles.action}
          accessibilityLabel="Explain it differently">
          <Doodle name="bulb" size={28} />
        </Sticker>
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

// Fraunces Bold is wide: about 0.6 of the font size per character.
const CHAR_WIDTH = 0.6;
const SPEAKER_SPACE = 28 + Spacing.md;

// The headword's font size from its length, instead of iOS shrink-to-fit
// (which could shrink short words too, before the width was known). Longer
// words step down and wrap onto up to 3 lines; the longest single word (e.g. a
// German compound) always fits on one line, never breaking mid-word.
function headwordSize(text: string, width: number) {
  const size = text.length <= 14 ? 44 : text.length <= 22 ? 38 : text.length <= 32 ? 32 : 28;
  const longest = Math.max(...text.split(/\s+/).map((t) => t.length + 1)); // +1 for the dot
  return Math.max(22, Math.min(size, Math.floor(width / (longest * CHAR_WIDTH))));
}

// The word in large Fraunces, the speaker button, and the part of speech.
export function WordHeading({ word }: { word: WordEntry }) {
  const theme = useTheme();
  const [speaking, setSpeaking] = useState(false);
  // Room for the word: measured once laid out; the screen width until then.
  const { width: screen } = useWindowDimensions();
  const [rowWidth, setRowWidth] = useState(screen - Spacing.xl * 2);
  const size = headwordSize(word.word, rowWidth - SPEAKER_SPACE);

  const speak = () => {
    setSpeaking(true);
    pronounce(word, 'w', () => setSpeaking(false));
  };

  return (
    <View style={styles.heading}>
      <View style={styles.wordRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        <Text style={[styles.word, { color: theme.word, fontSize: size, lineHeight: Math.round(size * 1.23) }]}>
          {word.word}
          {/* Terracotta dot, echoing the "t." app icon. */}
          <Text style={{ color: theme.spark }}>.</Text>
        </Text>
        <Pressable onPress={speak} hitSlop={12} accessibilityLabel="Pronounce">
          <Doodle name="speaker" size={28} color={speaking ? theme.spark : theme.textSecondary} />
        </Pressable>
      </View>
      <View style={styles.posRow}>
        {!!word.partOfSpeech && (
          <Text style={[styles.pos, { color: theme.textSecondary }]}>{word.partOfSpeech}</Text>
        )}
        {word.source === 'ai' && (
          <View
            style={[styles.aiPill, { borderColor: theme.textSecondary }]}
            accessibilityLabel="Card written by AI">
            <Text style={[styles.aiText, { color: theme.textSecondary }]}>AI</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// The example sentence. With `word`, a speaker button reads it aloud.
export function Example({ text, word }: { text: string; word?: WordEntry }) {
  const theme = useTheme();
  const [speaking, setSpeaking] = useState(false);
  // Own cards (SPEC 4.23) may have no example.
  if (!text.trim()) return null;
  const speak = () => {
    if (!word) return;
    setSpeaking(true);
    pronounce(word, 'e', () => setSpeaking(false));
  };
  return (
    <View style={[styles.example, { borderLeftColor: theme.accent }]}>
      <Text style={[styles.exampleText, { color: theme.text }]}>“{text}”</Text>
      {word && (
        <Pressable onPress={speak} hitSlop={10} accessibilityLabel="Read the example aloud" style={styles.exampleSpeaker}>
          <Doodle name="speaker" size={22} color={speaking ? theme.spark : theme.textSecondary} />
        </Pressable>
      )}
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
  posRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  // DESIGN.md 3: marked with an outline, not a color of its own.
  aiPill: { borderWidth: 1, borderRadius: Radius.chip, paddingHorizontal: 6, paddingVertical: 1 },
  aiText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  definition: { ...Type.body },
  example: { borderLeftWidth: 2, paddingLeft: Spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  exampleSpeaker: { paddingTop: 2 },
  exampleText: { flex: 1, fontFamily: Fonts.italic, fontSize: 18, lineHeight: 26 },
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
