import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Example, WordHeading } from '@/components/word-card';
import { StickerButton } from '@/components/sticker';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Level, WordEntry } from '@/lib/types';

// The small PREMIUM pill (DESIGN.md 3), optionally with a lock.
export function PremiumBadge({ lock, label = 'PREMIUM' }: { lock?: boolean; label?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.premiumSoft }]}>
      {lock && <Ionicons name="lock-closed" size={12} color={theme.premium} />}
      <Text style={[styles.pillText, { color: theme.premium }]}>{label}</Text>
    </View>
  );
}

// DESIGN.md 6: a Premium word blurred behind a terracotta lock. Tapping opens the paywall.
export function LockedCard({
  word,
  message,
  height,
  onPress,
}: {
  word: WordEntry;
  message: string;
  height: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={[styles.card, { height }]} onPress={onPress} accessibilityRole="button">
      <View style={styles.content} pointerEvents="none">
        <Text style={[Type.label, { color: theme.textSecondary }]}>{word.level}</Text>
        <WordHeading word={word} />
        <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>
        <Example text={word.example} />
      </View>
      <BlurView intensity={40} tint={theme.scheme} style={[StyleSheet.absoluteFill, styles.center]}>
        <Ionicons name="lock-closed" size={40} color={theme.premium} />
        <PremiumBadge />
        <Text style={[styles.message, { color: theme.text }]}>{message}</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Tap to see Premium</Text>
      </BlurView>
    </Pressable>
  );
}

// SPEC 4.12: shown once when most of a level's words have been seen.
export function LevelUpCard({
  level,
  locked,
  height,
  onPress,
}: {
  level: Level;
  locked: boolean;
  height: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.card, styles.center, { height }]}>
      <Ionicons name="trending-up" size={40} color={theme.accent} />
      <Text style={[styles.title, { color: theme.text }]}>You&apos;re ready for {level}.</Text>
      <Text style={[styles.hint, { color: theme.textSecondary }]}>
        You have seen most of the words at your level.
      </Text>
      <StickerButton
        label={`Switch to ${level}`}
        onPress={onPress}
        icon={locked ? <Ionicons name="lock-closed" size={16} color={theme.background} /> : undefined}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { justifyContent: 'center', paddingHorizontal: Spacing.xl },
  content: { gap: Spacing.lg },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl },
  definition: { ...Type.body },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  pillText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  message: { fontFamily: Fonts.title, fontSize: 26, textAlign: 'center' },
  title: { fontFamily: Fonts.title, fontSize: 30, textAlign: 'center' },
  hint: { fontSize: 15, textAlign: 'center' },
  button: { alignSelf: 'center', marginTop: Spacing.lg },
  buttonText: { fontSize: 17, fontWeight: '600' },
});
