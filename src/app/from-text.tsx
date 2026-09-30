import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { Doodle } from '@/components/doodle-icons';
import { ExplainLink } from '@/components/explain-link';
import { Sticker, StickerButton } from '@/components/sticker';
import { Example, Translation, WordHeading } from '@/components/word-card';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { coachAvailable, findWordsInText, FoundWord, FromTextMode } from '@/lib/coach';
import { setCreditLeft } from '@/lib/credits';
import { levelAbove } from '@/lib/gating';
import { usePremium } from '@/lib/premium';
import { Settings, WordEntry } from '@/lib/types';
import { allWords, registerCustomWords, wordById } from '@/lib/words';

const MODES: { id: FromTextMode; label: string; max: number }[] = [
  { id: 'link', label: 'Link', max: 10 },
  { id: 'photo', label: 'Photo', max: 8 },
  { id: 'text', label: 'Text', max: 5 },
];
const MAX_PHOTOS = 3;
const MAX_TEXT = 20_000;

type Found = { word: WordEntry; sentence: string };

// Dataset words the model may match in the text: the user's level and the one above.
function candidateWords(settings: Settings) {
  const levels = [settings.level, levelAbove(settings.level)].filter(Boolean);
  return allWords(settings.learningLang).filter((w) => levels.includes(w.level));
}

// Dataset words by ID; the rest become AI-made cards (like Snap a word) whose
// example is the sentence from the text.
function toFound(words: FoundWord[], settings: Settings): Found[] {
  const stamp = Date.now().toString(36);
  return words
    .map((w, i): Found | null => {
      if ('id' in w) {
        const word = wordById(w.id);
        return word ? { word, sentence: w.sentence } : null;
      }
      return {
        sentence: w.sentence,
        word: {
          id: `ai-${stamp}-${i}`,
          lang: settings.learningLang,
          level: settings.level,
          category: 'everyday',
          word: w.word,
          partOfSpeech: w.partOfSpeech,
          definition: w.definition,
          example: w.sentence,
          translations: { [settings.nativeLang]: w.translation },
          source: 'ai',
        },
      };
    })
    .filter((f): f is Found => !!f);
}

// A short set name from what was read.
function setName(mode: FromTextMode, title: string, text: string) {
  const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (mode === 'link' && title) return clean(title.split(/ [-–|] /)[0]).slice(0, 40);
  if (mode === 'text' && text.trim()) {
    const words = clean(text).split(' ').slice(0, 5).join(' ');
    return words.length > 36 ? `${words.slice(0, 36)}…` : words;
  }
  return `Photo words, ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

// SPEC 4.22: find the words worth learning in a link, photos of pages, or
// pasted text. Premium only, 10 a day.
export default function FromText() {
  const theme = useTheme();
  const { settings, savedIds, toggleFavorite, addCustomWord, createSetWith } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [mode, setMode] = useState<FromTextMode>('link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title: string; found: Found[]; mode: FromTextMode } | null>(null);
  const [savedSet, setSavedSet] = useState<string | null>(null);

  if (!settings) return null;

  if (!isPremium) {
    return (
      <View style={[styles.locked, { backgroundColor: theme.background }]}>
        <Doodle name="page" size={48} />
        <Text style={[styles.title, { color: theme.text }]}>Words from a text</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Turn any article, page or text into word cards. Part of Termin Premium.
        </Text>
        <StickerButton label="See Premium" variant="premium" onPress={showPaywall} style={styles.wide} />
      </View>
    );
  }

  const max = MODES.find((m) => m.id === mode)!.max;
  const ready =
    mode === 'link' ? /^https?:\/\/\S+\.\S+/.test(url.trim()) : mode === 'text' ? text.trim().length >= 20 : photos.length > 0;

  const paste = async () => {
    const clip = (await Clipboard.getStringAsync()).trim();
    if (!clip) return;
    if (mode === 'link') setUrl(clip);
    else setText(clip.slice(0, MAX_TEXT));
  };

  const addPhotos = async (source: 'camera' | 'library') => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera is off', 'Allow the camera for Expo Go in the iPhone Settings to photograph a page.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
    }
    const room = MAX_PHOTOS - photos.length;
    const picked =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            allowsMultipleSelection: true,
            selectionLimit: room,
          });
    if (picked.canceled) return;
    setPhotos((p) => [...p, ...picked.assets.map((a) => a.uri)].slice(0, MAX_PHOTOS));
  };

  const find = async () => {
    setLoading(true);
    setResult(null);
    setSavedSet(null);
    const out = await findWordsInText(
      mode,
      mode === 'link' ? { url: url.trim() } : mode === 'text' ? { text: text.trim() } : { photos },
      settings.learningLang,
      settings.nativeLang,
      settings.level,
      candidateWords(settings),
      isPremium
    );
    setLoading(false);
    if (out === 'limit') {
      setCreditLeft('fromText', 0);
      Alert.alert('Daily limit reached', "You've used today's 10 texts. Try again tomorrow.");
    } else if (out === 'unreadable') {
      Alert.alert("Couldn't read this page", 'Copy the text of the article and paste it under Text instead.');
    } else if (out === 'network') {
      Alert.alert('Could not read it', 'Check your connection and try again.');
    } else {
      if (out.remaining !== undefined) setCreditLeft('fromText', out.remaining);
      const found = toFound(out.words, settings);
      registerCustomWords(found.map((f) => f.word).filter((w) => w.source === 'ai'));
      setResult({ title: out.title, found, mode });
    }
  };

  const keep = (word: WordEntry) => {
    if (word.source === 'ai') addCustomWord(word);
  };

  const heart = (word: WordEntry) => {
    if (!savedIds.has(word.id)) keep(word);
    toggleFavorite(word.id);
  };

  const saveAll = () => {
    if (!result) return;
    const name = setName(result.mode, result.title, text);
    result.found.forEach((f) => keep(f.word));
    createSetWith(
      name,
      result.found.map((f) => f.word.id)
    );
    setSavedSet(name);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive">
      {/* iOS 26 draws a glass bubble behind header items; the pill has its own outline. */}
      <Stack.Screen
        options={{
          unstable_headerRightItems: () => [
            { type: 'custom', element: <CreditPill kind="fromText" />, hidesSharedBackground: true },
          ],
        }}
      />
      <Text style={[styles.hint, styles.left, { color: theme.textSecondary }]}>
        Termin finds the words worth learning in what you read.
      </Text>

      <View style={styles.modes}>
        {MODES.map((m) => {
          const on = m.id === mode;
          return (
            <Pressable
              key={m.id}
              onPress={() => setMode(m.id)}
              disabled={loading}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.mode,
                { backgroundColor: on ? theme.accentSoft : theme.background, borderColor: on ? theme.accent : theme.border },
              ]}>
              <Text style={[styles.modeText, { color: on ? theme.text : theme.textSecondary }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'link' && (
        <View style={styles.row}>
          <TextInput
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
            style={[styles.input, styles.flex, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          />
          <StickerButton label="Paste" variant="secondary" onPress={paste} disabled={loading} style={styles.paste} />
        </View>
      )}

      {mode === 'text' && (
        <>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.slice(0, MAX_TEXT))}
            placeholder="Paste or type a text in the language you're learning."
            placeholderTextColor={theme.textSecondary}
            multiline
            editable={!loading}
            style={[styles.input, styles.textBox, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
          />
          <StickerButton label="Paste" variant="secondary" onPress={paste} disabled={loading} />
        </>
      )}

      {mode === 'photo' && (
        <>
          {photos.length > 0 && (
            <View style={styles.thumbs}>
              {photos.map((uri) => (
                <View key={uri}>
                  <Image source={{ uri }} style={[styles.thumb, { borderColor: theme.text }]} />
                  <Pressable
                    onPress={() => setPhotos((p) => p.filter((x) => x !== uri))}
                    hitSlop={8}
                    accessibilityLabel="Remove photo"
                    style={[styles.remove, { backgroundColor: theme.background }]}>
                    <Ionicons name="close-circle" size={22} color={theme.textSecondary} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
          {photos.length < MAX_PHOTOS && (
            <View style={styles.row}>
              <StickerButton
                label="Take photo"
                variant="secondary"
                onPress={() => addPhotos('camera')}
                disabled={loading}
                style={styles.flex}
              />
              <StickerButton
                label="Choose photos"
                variant="secondary"
                onPress={() => addPhotos('library')}
                disabled={loading}
                style={styles.flex}
              />
            </View>
          )}
          <Text style={[styles.small, { color: theme.textSecondary }]}>Up to {MAX_PHOTOS} pages.</Text>
        </>
      )}

      <StickerButton label={`Find up to ${max} words`} onPress={find} disabled={!ready || !coachAvailable} loading={loading} />
      {loading && (
        <Text style={[styles.small, styles.center, { color: theme.textSecondary }]}>
          Reading… this can take up to a minute.
        </Text>
      )}

      {result && !loading && (
        <>
          {!!result.title && <Text style={[styles.resultTitle, { color: theme.text }]}>{result.title}</Text>}
          {!result.found.length ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              No words worth learning at your level here. Is the text in the language you&apos;re learning?
            </Text>
          ) : (
            <StickerButton
              label={savedSet ? `Saved to “${savedSet}”` : `Save all ${result.found.length} to a new set`}
              onPress={saveAll}
              disabled={!!savedSet}
            />
          )}
          {result.found.map(({ word, sentence }) => {
            const saved = savedIds.has(word.id);
            return (
              <Sticker key={word.id} contentStyle={styles.card}>
                <WordHeading word={word} />
                <Text style={[styles.definition, { color: theme.text }]}>{word.definition}</Text>
                <View style={styles.fromText}>
                  <Text style={[Type.label, { color: theme.textSecondary }]}>From the text</Text>
                  <Example text={sentence} />
                </View>
                <Translation word={word} nativeLang={settings.nativeLang} />
                <View style={styles.cardFoot}>
                  <ExplainLink wordId={word.id} />
                  <Pressable
                    onPress={() => heart(word)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={saved ? `Remove ${word.word} from Favorites` : `Save ${word.word}`}
                    style={styles.save}>
                    <Doodle name="heart" size={24} filled={saved} />
                  </Pressable>
                </View>
              </Sticker>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  hint: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  left: { textAlign: 'left' },
  center: { textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  flex: { flex: 1 },
  wide: { alignSelf: 'stretch' },
  modes: { flexDirection: 'row', gap: Spacing.sm },
  mode: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.chip, borderWidth: 1.5 },
  modeText: { fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.chip,
    padding: Spacing.md,
    fontSize: 17,
  },
  textBox: { minHeight: 160, maxHeight: 320, textAlignVertical: 'top' },
  paste: { alignSelf: 'auto' },
  thumbs: { flexDirection: 'row', gap: Spacing.md },
  thumb: { width: 96, height: 128, borderRadius: Radius.chip, borderWidth: 1.5 },
  remove: { position: 'absolute', top: -8, right: -8, borderRadius: 11 },
  resultTitle: { fontFamily: Fonts.title, fontSize: 22, lineHeight: 28 },
  card: { padding: Spacing.xl, gap: Spacing.lg },
  definition: { fontSize: 17, lineHeight: 24 },
  fromText: { gap: Spacing.sm },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  save: { padding: Spacing.xs },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  title: { fontFamily: Fonts.title, fontSize: 28 },
});
