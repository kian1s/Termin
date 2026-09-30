import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { Sticker, StickerButton } from '@/components/sticker';
import { TutorNote, useTutorMood } from '@/components/tutor-note';
import { Example, Translation, WordHeading } from '@/components/word-card';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { AddWordCard, coachAvailable, writeWordCard } from '@/lib/coach';
import { setCreditLeft, useCredit } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { FAVORITES_ID, LANG_NAMES, Settings, WordEntry } from '@/lib/types';
import { allWords } from '@/lib/words';

type Mode = 'own' | 'ai';

// Leading articles and "to", so "die Nachhaltigkeit" or "to concede" match however they're typed.
const ARTICLES = /^(the|to|a|an|der|die|das|le|la|les|l'|un|une|el|los|las|o|os|as)\s+/i;
const normalize = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[.!?,;:]+$/, '')
    .replace(ARTICLES, '')
    .replace(/\s+/g, ' ');

// IDs for cards made on the phone, e.g. "own-mg2k3x1a".
const newId = (prefix: 'own' | 'ai') => `${prefix}-${Date.now().toString(36)}`;

// A word Termin already has, in the learning language.
function findInTermin(typed: string, settings: Settings) {
  const key = normalize(typed);
  if (key.length < 2) return undefined;
  return allWords(settings.learningLang).find((w) => normalize(w.word) === key);
}

// SPEC 4.23: add a word of your own to a set. If Termin has it, its own card
// is used (free). Otherwise write it yourself (free, unlimited) or let the AI
// write it (free 2 a month, Premium 30 a month).
export default function AddWord() {
  const theme = useTheme();
  const { setId } = useLocalSearchParams<{ setId?: string }>();
  const { settings, sets, addToSet, addCustomWord } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const credit = useCredit('addWord');
  const [typed, setTyped] = useState('');
  const [mode, setMode] = useState<Mode>('own');
  const [definition, setDefinition] = useState('');
  const [translation, setTranslation] = useState('');
  const [example, setExample] = useState('');
  const [loading, setLoading] = useState(false);
  // The AI's card, made into an entry once when it arrives (null: not a real word).
  const [aiCard, setAiCard] = useState<{ typed: string; entry: WordEntry | null } | null>(null);

  const [tutorMood, setTutorReaction] = useTutorMood(loading);

  if (!settings) return null;
  const target = sets.find((s) => s.id === setId) ?? sets.find((s) => s.id === FAVORITES_ID)!;
  const termin = findInTermin(typed, settings);
  const word = typed.trim();
  // An AI card only belongs to the word it was written for.
  const shownAi = aiCard && aiCard.typed === word ? aiCard.entry : undefined;

  const add = (entry: WordEntry) => {
    if (entry.source) addCustomWord(entry);
    addToSet(target.id, entry.id);
    router.back();
  };

  const addOwn = () =>
    add({
      id: newId('own'),
      lang: settings.learningLang,
      level: settings.level,
      category: 'everyday',
      word,
      partOfSpeech: '',
      definition: definition.trim(),
      example: example.trim(),
      translations: translation.trim() ? { [settings.nativeLang]: { word: translation.trim(), definition: '' } } : {},
      source: 'own',
    });

  const writeWithAi = async () => {
    setLoading(true);
    const out = await writeWordCard(word, settings.learningLang, settings.nativeLang, settings.level, isPremium);
    setLoading(false);
    setTutorReaction(typeof out === 'string' || !out.card ? 'sad' : 'happy');
    if (out === 'limit') setCreditLeft('addWord', 0);
    else if (out === 'network') Alert.alert("Couldn't write the card", 'Check your connection and try again.');
    else {
      setCreditLeft('addWord', out.remaining);
      setAiCard({ typed: word, entry: out.card ? aiEntry(out.card) : null });
    }
  };

  const aiEntry = (card: AddWordCard): WordEntry => ({
    id: newId('ai'),
    lang: settings.learningLang,
    level: card.level,
    category: card.category,
    word: card.word,
    partOfSpeech: card.partOfSpeech,
    definition: card.definition,
    example: card.example,
    translations: { [settings.nativeLang]: card.translation },
    source: 'ai',
  });

  const inputStyle = [styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }];
  const aiOut = credit?.left === 0;

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
            { type: 'custom', element: <CreditPill kind="addWord" />, hidesSharedBackground: true },
          ],
        }}
      />
      <TutorNote mood={tutorMood}>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>Adds to {target.name}.</Text>
      </TutorNote>

      <TextInput
        value={typed}
        onChangeText={setTyped}
        placeholder={`A word in ${LANG_NAMES[settings.learningLang]}`}
        placeholderTextColor={theme.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        maxLength={80}
        style={[inputStyle, styles.wordInput]}
      />

      {termin ? (
        <>
          <Text style={[Type.label, { color: theme.accent }]}>Termin has this word</Text>
          <Sticker contentStyle={styles.card}>
            <WordHeading word={termin} />
            <Text style={[styles.body, { color: theme.text }]}>{termin.definition}</Text>
            <Example text={termin.example} word={termin} />
            <Translation word={termin} nativeLang={settings.nativeLang} />
          </Sticker>
          <StickerButton
            label={target.wordIds.includes(termin.id) ? `Already in ${target.name}` : `Add to ${target.name}`}
            onPress={() => add(termin)}
            disabled={target.wordIds.includes(termin.id)}
          />
        </>
      ) : word.length >= 2 ? (
        <>
          <View style={styles.modes}>
            {(
              [
                { id: 'own', label: 'Write it myself' },
                { id: 'ai', label: 'Write it with AI' },
              ] as const
            ).map((m) => {
              const on = m.id === mode;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => setMode(m.id)}
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

          {mode === 'own' ? (
            <>
              <TextInput
                value={definition}
                onChangeText={setDefinition}
                placeholder="What it means"
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={240}
                style={[inputStyle, styles.multi]}
              />
              <TextInput
                value={translation}
                onChangeText={setTranslation}
                placeholder={`In ${LANG_NAMES[settings.nativeLang]} (optional)`}
                placeholderTextColor={theme.textSecondary}
                maxLength={80}
                style={inputStyle}
              />
              <TextInput
                value={example}
                onChangeText={setExample}
                placeholder="An example sentence (optional)"
                placeholderTextColor={theme.textSecondary}
                multiline
                maxLength={300}
                style={[inputStyle, styles.multi]}
              />
              <StickerButton label="Add word" onPress={addOwn} disabled={!definition.trim()} />
            </>
          ) : shownAi ? (
            <>
              <Sticker contentStyle={styles.card}>
                <WordHeading word={shownAi} />
                <Text style={[styles.body, { color: theme.text }]}>{shownAi.definition}</Text>
                <Example text={shownAi.example} word={shownAi} />
                <Translation word={shownAi} nativeLang={settings.nativeLang} />
              </Sticker>
              <StickerButton label={`Add to ${target.name}`} onPress={() => add(shownAi)} />
            </>
          ) : shownAi === null ? (
            <Text style={[styles.hint, { color: theme.textSecondary }]}>
              That doesn&apos;t look like a word in {LANG_NAMES[settings.learningLang]}. Check the spelling, or write
              it yourself. This didn&apos;t use up an AI card.
            </Text>
          ) : aiOut ? (
            <View style={styles.block}>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>
                {isPremium
                  ? "You've used this month's 30 AI cards. You can still write it yourself."
                  : "You've used this month's 2 free AI cards. Premium gets 30 a month."}
              </Text>
              {!isPremium && <StickerButton label="See Premium" variant="premium" onPress={showPaywall} />}
            </View>
          ) : (
            <StickerButton
              label="Write with AI"
              onPress={writeWithAi}
              loading={loading}
              disabled={!coachAvailable}
            />
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },
  hint: { fontSize: 15, lineHeight: 21 },
  body: { fontSize: 17, lineHeight: 24 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.chip, padding: Spacing.md, fontSize: 17 },
  wordInput: { fontSize: 20 },
  multi: { minHeight: 80, textAlignVertical: 'top' },
  modes: { flexDirection: 'row', gap: Spacing.sm },
  mode: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.chip, borderWidth: 1.5 },
  modeText: { fontSize: 15, fontWeight: '600' },
  card: { padding: Spacing.xl, gap: Spacing.lg },
  block: { gap: Spacing.md },
});
