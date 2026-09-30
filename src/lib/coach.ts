import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

import { Lang, WordEntry } from '@/lib/types';

// The AI Coach Worker (SPEC 6). Without a URL the review card falls back to
// Reveal and self-rating.
const COACH_URL = process.env.EXPO_PUBLIC_COACH_URL?.replace(/\/$/, '');
export const coachAvailable = !!COACH_URL;

export type Verdict = 'correct' | 'partly' | 'incorrect';
export type CoachResult = {
  verdict: Verdict;
  feedback: string;
  improvedSentence: string;
  remainingToday: number;
};
export type CoachError = 'limit' | 'network';

// A random ID for this install, used only for the daily check limit.
let deviceIdPromise: Promise<string> | null = null;
export function getDeviceId() {
  deviceIdPromise ??= (async () => {
    const stored = await AsyncStorage.getItem('deviceId');
    if (stored) return stored;
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AsyncStorage.setItem('deviceId', id);
    return id;
  })();
  return deviceIdPromise;
}

export async function checkAnswer(
  word: WordEntry,
  answer: string,
  nativeLang: Lang,
  feedbackLang: Lang,
  isPremium: boolean
): Promise<CoachResult | CoachError> {
  if (!COACH_URL) return 'network';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${COACH_URL}/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: await getDeviceId(),
        isPro: isPremium,
        learningLang: word.lang,
        nativeLang,
        feedbackLang,
        word: word.word,
        definition: word.definition,
        answer,
      }),
      signal: controller.signal,
    });
    if (res.status === 429) return 'limit';
    if (!res.ok) return 'network';
    return (await res.json()) as CoachResult;
  } catch {
    return 'network';
  } finally {
    clearTimeout(timer);
  }
}

// What a recording is about: its language and, for a review answer, the word
// Whisper should spell right. A WordEntry fits.
export type VoiceHint = { lang: Lang; word?: string };

// Sends a recorded answer to the Worker's Whisper endpoint (SPEC 4.6).
// Returns the transcript, or an error description.
export async function transcribe(uri: string, hint: VoiceHint): Promise<{ text: string } | { error: string }> {
  if (!COACH_URL) return { error: 'No coach URL configured' };
  const form = new FormData();
  form.append('deviceId', await getDeviceId());
  form.append('learningLang', hint.lang);
  if (hint.word) form.append('word', hint.word);
  // SDK 57's fetch uploads local files as expo-file-system File objects (a Blob).
  form.append('audio', new File(uri));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${COACH_URL}/transcribe`, { method: 'POST', body: form, signal: controller.signal });
    const body = await res.text();
    if (!res.ok) return { error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
    const text = (JSON.parse(body) as { text?: string }).text?.trim();
    return text ? { text } : { error: 'Empty transcript (no speech heard)' };
  } catch (e) {
    return { error: `Upload failed: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    clearTimeout(timer);
  }
}

export type Tone = 'natural' | 'formal' | 'academic';
export type Swap = { id: string; from: string; to: string; why: string };
export type RewriteResult = { rewrite: string; swaps: Swap[] };

// SPEC 4.18, Say it better: the Worker rewrites the sentence with words from
// `candidates` (saved words first). Premium only.
export async function rewriteSentence(
  sentence: string,
  tone: Tone,
  learningLang: Lang,
  feedbackLang: Lang,
  candidates: { word: WordEntry; saved: boolean }[],
  isPremium: boolean
): Promise<RewriteResult | CoachError> {
  if (!COACH_URL) return 'network';
  const controller = new AbortController();
  // The model reasons before answering, which can take 10 to 30 seconds.
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${COACH_URL}/rewrite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: await getDeviceId(),
        isPro: isPremium,
        learningLang,
        feedbackLang,
        tone,
        sentence,
        candidates: candidates.map((c) => ({ id: c.word.id, word: c.word.word, saved: c.saved })),
      }),
      signal: controller.signal,
    });
    if (res.status === 429) return 'limit';
    if (!res.ok) return 'network';
    return (await res.json()) as RewriteResult;
  } catch {
    return 'network';
  } finally {
    clearTimeout(timer);
  }
}
