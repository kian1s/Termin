import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { Doodle } from '@/components/doodle-icons';
import { Sticker, StickerButton } from '@/components/sticker';
import { Example, Translation, WordHeading } from '@/components/word-card';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { coachAvailable, FREE_SNAPS, SnapCard, snapWords } from '@/lib/coach';
import { setCreditLeft, useCredit } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { Settings, WordEntry } from '@/lib/types';

// An AI-made card as a normal word entry, so saving and reviewing work as usual.
function toEntry(card: SnapCard, settings: Settings, index: number): WordEntry {
  return {
    id: `ai-${Date.now().toString(36)}-${index}`,
    lang: settings.learningLang,
    level: settings.level,
    category: 'everyday',
    word: card.word,
    partOfSpeech: card.partOfSpeech,
    definition: card.definition,
    example: card.example,
    translations: { [settings.nativeLang]: card.translation },
    source: 'ai',
  };
}

// SPEC 4.19: take or choose a photo, get one AI-made card (more only when
// clearly worth it) for something in it. Free: 2 photos ever; Premium: 10 a day.
export default function Snap() {
  const theme = useTheme();
  const { settings, savedIds, toggleFavorite, addCustomWord, freeSnapsUsed, setFreeSnapsUsed } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cards, setCards] = useState<WordEntry[] | null>(null);
  const snapCredit = useCredit('snap');

  if (!settings) return null;
  // The Worker's count when known; the phone's own count offline.
  const freeLeft = snapCredit && !isPremium ? snapCredit.left : Math.max(0, FREE_SNAPS - freeSnapsUsed);

  if (!isPremium && freeLeft === 0) {
    return (
      <View style={[styles.locked, { backgroundColor: theme.background }]}>
        <Doodle name="camera" size={48} />
        <Text style={[styles.title, { color: theme.text }]}>Snap a word</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          You&apos;ve used your 2 free photos. Premium gets 10 a day.
        </Text>
        <StickerButton label="See Premium" variant="premium" onPress={showPaywall} style={styles.wide} />
      </View>
    );
  }

  const pick = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera is off', 'Allow the camera for Expo Go in the iPhone Settings to snap a word.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    const picked =
      source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets[0]) return;
    const uri = picked.assets[0].uri;
    setPhoto(uri);
    setCards(null);
    setLoading(true);
    const out = await snapWords(uri, settings.learningLang, settings.nativeLang, settings.level, isPremium);
    setLoading(false);
    if (out === 'free-used' || out === 'limit') setCreditLeft('snap', 0);
    if (typeof out !== 'string' && out.remaining !== undefined) setCreditLeft('snap', out.remaining);
    if (out === 'free-used') {
      setFreeSnapsUsed(FREE_SNAPS);
      setPhoto(null);
    } else if (out === 'limit') {
      Alert.alert('Daily limit reached', "You've used today's 10 photos. Try again tomorrow.");
    } else if (out === 'network') {
      Alert.alert('Could not read the photo', 'Check your connection and try again.');
    } else {
      if (out.freeUsed !== undefined) setFreeSnapsUsed(out.freeUsed);
      setCards(out.cards.map((c, i) => toEntry(c, settings, i)));
    }
  };

  const save = (word: WordEntry) => {
    if (!savedIds.has(word.id)) addCustomWord(word);
    toggleFavorite(word.id);
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      {/* iOS 26 draws a glass bubble behind header items; the pill has its own outline. */}
      <Stack.Screen
        options={{
          unstable_headerRightItems: () => [
            { type: 'custom', element: <CreditPill kind="snap" />, hidesSharedBackground: true },
          ],
        }}
      />
      <Text style={[styles.hint, styles.left, { color: theme.textSecondary }]}>
        Termin finds a word at your level in any photo.
      </Text>

      <View style={styles.row}>
        <StickerButton
          label="Take photo"
          onPress={() => pick('camera')}
          disabled={loading || !coachAvailable}
          style={styles.flex}
        />
        <StickerButton
          label="Choose photo"
          variant="secondary"
          onPress={() => pick('library')}
          disabled={loading || !coachAvailable}
          style={styles.flex}
        />
      </View>
      {!isPremium && (
        <Pressable onPress={showPaywall} hitSlop={8}>
          <Text style={[styles.small, styles.center, { color: theme.premium }]}>
            {freeLeft} free {freeLeft === 1 ? 'photo' : 'photos'} left · Premium gets 10 a day
          </Text>
        </Pressable>
      )}

      {photo && <Image source={{ uri: photo }} style={[styles.photo, { borderColor: theme.text }]} resizeMode="cover" />}
      {loading && (
        <Text style={[styles.small, styles.center, { color: theme.textSecondary }]}>Looking at your photo…</Text>
      )}

      {cards && !cards.length && (
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          No word worth learning in this one. Try another photo.
        </Text>
      )}
      {cards?.map((word) => {
        const saved = savedIds.has(word.id);
        return (
          <Sticker key={word.id} contentStyle={styles.card}>
            <WordHeading word={word} />
            <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>
            <Example text={word.example} word={word} />
            <Translation word={word} nativeLang={settings.nativeLang} />
            <Pressable
              onPress={() => save(word)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={saved ? `Remove ${word.word} from Favorites` : `Save ${word.word}`}
              style={styles.save}>
              <Doodle name="heart" size={24} filled={saved} />
              <Text style={[styles.saveText, { color: saved ? theme.textSecondary : theme.accent }]}>
                {saved ? 'Saved to Favorites' : 'Save'}
              </Text>
            </Pressable>
          </Sticker>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  hint: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1 },
  wide: { alignSelf: 'stretch' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.card, borderWidth: 1.5 },
  card: { padding: Spacing.xl, gap: Spacing.lg },
  definition: { fontSize: 17, lineHeight: 24 },
  save: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
  saveText: { fontSize: 15, fontWeight: '600' },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  title: { fontFamily: Fonts.title, fontSize: 28 },
});
