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

async function localClip(word: WordEntry, clip: Clip): Promise<string | null> {
  if (!BASE) return null;
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

export function stopPronouncing() {
  Speech.stop();
  current?.remove();
  current = null;
}

// Reads the word or its example aloud; `onDone` fires when it finishes.
export async function pronounce(word: WordEntry, clip: Clip, onDone: () => void) {
  stopPronouncing();
  const uri = await localClip(word, clip);
  if (uri) {
    try {
      // Play even with the ring/silent switch on, like the speech it replaces.
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      const player = createAudioPlayer(uri);
      current = player;
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (!status.didJustFinish) return;
        sub.remove();
        player.remove();
        if (current === player) current = null;
        onDone();
      });
      player.play();
      return;
    } catch {
      // Fall back to the phone's voice below.
    }
  }
  const voice = await bestVoice(word.lang);
  Speech.speak(clip === 'w' ? word.word : word.example, {
    language: SPEECH_VOICES[word.lang],
    voice: voice?.id,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}
