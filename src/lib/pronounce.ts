import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { Directory, File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';

import { SPEECH_VOICES, WordEntry } from '@/lib/types';
import { bestVoice } from '@/lib/voices';

// SPEC 4.11 step 2: natural pronunciations recorded once with Azure neural
// voices (scripts/voices/generate.ts) and served by the Worker as static
// files. Each clip is downloaded on first play and kept on the phone. Without
// a clip (offline, or a word added later) the phone's best voice reads it.

const BASE = process.env.EXPO_PUBLIC_COACH_URL?.replace(/\/$/, '');

// "w" is the headword, "e" the example sentence.
export type Clip = 'w' | 'e';

let current: AudioPlayer | null = null;
let currentSub: { remove: () => void } | null = null;

async function localClip(word: WordEntry, clip: Clip): Promise<string | null> {
  // Cards made on the phone have no recording; the phone's voice reads them.
  if (!BASE || word.source) return null;
  const name = `${word.id}-${clip}.mp3`;
  const dir = new Directory(Paths.cache, 'audio', word.lang);
  const file = new File(dir, name);
  if (file.exists) return file.uri;
  try {
    dir.create({ intermediates: true, idempotent: true });
    const downloaded = await File.downloadFileAsync(`${BASE}/audio/${word.lang}/${name}`, file, { idempotent: true });
    return downloaded.uri;
  } catch {
    return null;
  }
}

// Only the latest tap may play: each call takes a number, and an older call
// that is still downloading or preparing gives up instead of playing over it.
let latest = 0;
// The playing button's onDone, so stopping resets its highlight.
let finishCurrent: (() => void) | null = null;

export function stopPronouncing() {
  latest++;
  Speech.stop();
  // remove() only frees the player; pause first, or it can keep playing
  // underneath the next sound.
  currentSub?.remove();
  currentSub = null;
  if (current) {
    try {
      current.pause();
    } catch {}
    current.remove();
  }
  current = null;
  const finish = finishCurrent;
  finishCurrent = null;
  finish?.();
}

// Reads the word or its example aloud; `onDone` fires once when it finishes
// or is stopped (by another tap, or by tapping the same button again).
export async function pronounce(word: WordEntry, clip: Clip, onDone: () => void) {
  stopPronouncing();
  const mine = ++latest;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    if (finishCurrent === finish) finishCurrent = null;
    onDone();
  };
  finishCurrent = finish;

  const uri = await localClip(word, clip);
  if (mine !== latest) return;
  if (uri) {
    try {
      // Play even with the ring/silent switch on, like the speech it replaces.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (mine !== latest) return;
      const player = createAudioPlayer(uri);
      current = player;
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) return;
        sub.remove();
        player.remove();
        if (current === player) {
          current = null;
          currentSub = null;
        }
        finish();
      });
      currentSub = sub;
      player.play();
      return;
    } catch {
      // Fall back to the phone's voice below.
    }
  }
  const voice = await bestVoice(word.lang);
  if (mine !== latest) return;
  Speech.speak(clip === 'w' ? word.word : word.example, {
    language: SPEECH_VOICES[word.lang],
    voice: voice?.id,
    onDone: finish,
    onStopped: finish,
    onError: finish,
  });
}
