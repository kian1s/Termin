import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CreditPill } from '@/components/credit-pill';
import { Doodle } from '@/components/doodle-icons';
import { Sticker, StickerButton } from '@/components/sticker';
import { TutorNote, useTutorMood } from '@/components/tutor-note';
import { Fonts, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/lib/app-state';
import { coachAvailable, RewriteResult, rewriteSentence, Tone } from '@/lib/coach';
import { setCreditLeft } from '@/lib/credits';
import { usePremium } from '@/lib/premium';
import { coachFeedbackLang, Settings, WordEntry } from '@/lib/types';
import { useVoiceAnswer } from '@/lib/voice';
import { shuffled, wordById, wordsAt } from '@/lib/words';

const TONES: { id: Tone; label: string }[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'formal', label: 'Formal' },
  { id: 'academic', label: 'Academic' },
];
const MAX_LENGTH = 300;
const MAX_CANDIDATES = 200;

// The default tone follows the user's categories (SPEC 4.18).
function defaultTone(settings: Settings | null): Tone {
  if (settings?.categories.includes('academic')) return 'academic';
  if (settings?.categories.includes('work')) return 'formal';
  return 'natural';
}

// Words the AI may use: saved words in the learning language first, then
// words at the user's level and categories.
function candidateWords(settings: Settings, savedIds: Set<string>) {
  const saved = [...savedIds]
    .map((id) => wordById(id))
    .filter((w): w is WordEntry => !!w && w.lang === settings.learningLang);
  const savedSet = new Set(saved.map((w) => w.id));
  const level = shuffled(wordsAt(settings.learningLang, settings.level, settings.categories)).filter(
    (w) => !savedSet.has(w.id)
  );
  return [
    ...saved.map((word) => ({ word, saved: true })),
    ...level.map((word) => ({ word, saved: false })),
  ].slice(0, MAX_CANDIDATES);
}

// Splits the rewrite into plain and highlighted parts, one highlight per swap.
function highlight(text: string, phrases: string[]) {
  const lower = text.toLowerCase();
  const ranges = phrases
    .map((p) => ({ start: lower.indexOf(p.toLowerCase()), length: p.length }))
    .filter((r) => r.start >= 0)
    .sort((a, b) => a.start - b.start);
  const parts: { text: string; mark: boolean }[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at) continue; // overlapping phrases: keep the first
    if (r.start > at) parts.push({ text: text.slice(at, r.start), mark: false });
    parts.push({ text: text.slice(r.start, r.start + r.length), mark: true });
    at = r.start + r.length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), mark: false });
  return parts;
}

// SPEC 4.18: write or say a sentence, get it back with stronger words from
// Termin's dataset, and save the new words in one tap. Premium only.
export default function SayItBetter() {
  const theme = useTheme();
  const { settings, savedIds, toggleFavorite } = useAppState();
  const { isPremium, showPaywall } = usePremium();
  const [text, setText] = useState('');
  const [tone, setTone] = useState<Tone>(() => defaultTone(settings));
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RewriteResult | null>(null);
  const voice = useVoiceAnswer({ lang: settings?.learningLang ?? 'en' }, (spoken) =>
    setText((t) => (t.trim() ? `${t.trim()} ${spoken}` : spoken).slice(0, MAX_LENGTH))
  );

  const [tutorMood, setTutorReaction] = useTutorMood(loading);

  if (!settings) return null;

  if (!isPremium) {
    return (
      <View style={[styles.locked, { backgroundColor: theme.background }]}>
        <Doodle name="pen" size={48} />
        <Text style={[styles.lockedTitle, { color: theme.text }]}>Say it better</Text>
        <Text style={[styles.hint, { color: theme.textSecondary }]}>
          Rewrite your sentences with stronger words. Part of Termin Premium.
        </Text>
        <StickerButton label="See Premium" variant="premium" onPress={showPaywall} style={styles.lockedButton} />
      </View>
    );
  }

  const busy = loading || voice.state !== 'idle';
  const canSubmit = coachAvailable && text.trim().length > 0 && !busy;

  const submit = async () => {
    setLoading(true);
    const out = await rewriteSentence(
      text.trim(),
      tone,
      settings.learningLang,
      coachFeedbackLang(settings),
      candidateWords(settings, savedIds),
      isPremium
    );
    setLoading(false);
    if (out === 'limit') setCreditLeft('rewrite', 0);
    if (typeof out !== 'string' && out.remaining !== undefined) setCreditLeft('rewrite', out.remaining);
    setTutorReaction(typeof out === 'string' ? 'sad' : 'happy');
    if (out === 'limit') Alert.alert('Daily limit reached', "You've used today's 30 rewrites. Try again tomorrow.");
    else if (out === 'network') Alert.alert("Couldn't rewrite", 'Check your connection and try again.');
    else setResult(out);
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
            { type: 'custom', element: <CreditPill kind="rewrite" />, hidesSharedBackground: true },
          ],
        }}
      />
      <TutorNote mood={tutorMood}>
        <Text style={[styles.hint, styles.left, { color: theme.textSecondary }]}>
          Write a sentence. Tutor rewrites it with stronger words you can save.
        </Text>
      </TutorNote>

      <View style={styles.tones}>
        {TONES.map((t) => {
          const on = t.id === tone;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTone(t.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.tone,
                { backgroundColor: on ? theme.accentSoft : theme.background, borderColor: on ? theme.accent : theme.border },
              ]}>
              <Text style={[styles.toneText, { color: on ? theme.text : theme.textSecondary }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="The plan didn't work because we had no money."
          placeholderTextColor={theme.textSecondary}
          multiline
          maxLength={MAX_LENGTH}
          editable={!busy}
          style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
        />
        <Pressable
          onPress={voice.toggle}
          disabled={voice.state === 'transcribing' || loading}
          accessibilityLabel={voice.state === 'recording' ? 'Stop recording' : 'Say it'}
          style={[styles.mic, { backgroundColor: voice.state === 'recording' ? theme.wrong : theme.accent }]}>
          {voice.state === 'transcribing' ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <Ionicons name={voice.state === 'recording' ? 'stop' : 'mic'} size={22} color={theme.background} />
          )}
        </Pressable>
      </View>
      {voice.state === 'recording' && (
        <Text style={[styles.small, { color: theme.wrong }]}>Recording… {voice.seconds}s of 30. Tap to stop.</Text>
      )}

      <StickerButton label="Say it better" onPress={submit} disabled={!canSubmit} loading={loading} />
      {loading && (
        <Text style={[styles.small, styles.center, { color: theme.textSecondary }]}>Finding stronger words…</Text>
      )}

      {result && !loading && (
        <>
          <Sticker outline={theme.accent} contentStyle={styles.resultCard}>
            <Text style={[Type.label, { color: theme.accent }]}>Better</Text>
            <Text style={[styles.rewrite, { color: theme.text }]}>
              {highlight(
                result.rewrite,
                result.swaps.map((s) => s.to)
              ).map((part, i) =>
                part.mark ? (
                  <Text key={i} style={[styles.mark, { color: theme.word, backgroundColor: theme.accentSoft }]}>
                    {part.text}
                  </Text>
                ) : (
                  part.text
                )
              )}
            </Text>
            {!result.swaps.length && (
              <Text style={[styles.small, { color: theme.textSecondary }]}>
                No new words fitted this time. Try a longer sentence or another tone.
              </Text>
            )}
          </Sticker>

          {result.swaps.map((swap) => {
            const word = wordById(swap.id);
            if (!word) return null;
            const saved = savedIds.has(word.id);
            return (
              <Sticker key={swap.id} contentStyle={styles.swap}>
                <Text style={[styles.swapLine, { color: theme.text }]}>
                  {swap.from ? (
                    <Text style={{ color: theme.textSecondary }}>{swap.from} → </Text>
                  ) : null}
                  <Text style={[styles.swapTo, { color: theme.word }]}>{swap.to}</Text>
                </Text>
                {!!swap.why && <Text style={[styles.small, { color: theme.textSecondary }]}>{swap.why}</Text>}
                <View style={styles.swapFoot}>
                  <Text style={[styles.small, { color: theme.textSecondary }]} numberOfLines={1}>
                    {word.word} · {word.level}
                  </Text>
                  <Pressable
                    onPress={() => toggleFavorite(word.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={saved ? `Remove ${word.word} from Favorites` : `Save ${word.word}`}
                    style={styles.save}>
                    <Doodle name="heart" size={22} filled={saved} />
                    <Text style={[styles.saveText, { color: saved ? theme.textSecondary : theme.accent }]}>
                      {saved ? 'Saved' : 'Save'}
                    </Text>
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
  tones: { flexDirection: 'row', gap: Spacing.sm },
  tone: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: Radius.chip,
    borderWidth: 1.5,
  },
  toneText: { fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 110,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.chip,
    padding: Spacing.md,
    paddingRight: 64,
    fontSize: 17,
    textAlignVertical: 'top',
  },
  mic: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultCard: { padding: Spacing.xl, gap: Spacing.md },
  rewrite: { fontFamily: Fonts.title, fontSize: 22, lineHeight: 32 },
  mark: { fontFamily: Fonts.word },
  swap: { padding: Spacing.lg, gap: Spacing.sm },
  swapLine: { fontSize: 17, lineHeight: 24 },
  swapTo: { fontFamily: Fonts.word },
  swapFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  save: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  saveText: { fontSize: 15, fontWeight: '600' },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
  lockedTitle: { fontFamily: Fonts.title, fontSize: 28 },
  lockedButton: { alignSelf: 'stretch' },
});
