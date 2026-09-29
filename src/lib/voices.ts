import * as Speech from 'expo-speech';

import { Lang, SPEECH_VOICES } from '@/lib/types';

// SPEC 4.11 step 1: read words with the best voice installed on the phone for
// the learning language: Premium, then Enhanced, then default. iOS marks
// Premium voices only in their identifier (e.g. "com.apple.voice.premium.…").

export type VoiceChoice = { id: string; name: string; quality: 'Premium' | 'Enhanced' | 'Default' };

const cache = new Map<Lang, Promise<VoiceChoice | null>>();

function rank(v: Speech.Voice, locale: string) {
  const id = v.identifier.toLowerCase();
  const quality = id.includes('premium') ? 3 : v.quality === Speech.VoiceQuality.Enhanced || id.includes('enhanced') ? 2 : 1;
  // Novelty and older synthesizer voices sound robotic; use them only as a last resort.
  const robotic = id.includes('eloquence') || id.includes('speech.synthesis') ? -10 : 0;
  // The exact region (e.g. pt-PT, not pt-BR) matters more than quality.
  const region = v.language.replace('_', '-').toLowerCase() === locale.toLowerCase() ? 10 : 0;
  return region + quality + robotic;
}

export function bestVoice(lang: Lang): Promise<VoiceChoice | null> {
  let found = cache.get(lang);
  if (!found) {
    const locale = SPEECH_VOICES[lang];
    found = Speech.getAvailableVoicesAsync()
      .then((voices) => {
        const best = voices
          .filter((v) => v.language.toLowerCase().startsWith(lang))
          .sort((a, b) => rank(b, locale) - rank(a, locale))[0];
        if (!best) return null;
        const id = best.identifier.toLowerCase();
        const quality: VoiceChoice['quality'] = id.includes('premium')
          ? 'Premium'
          : best.quality === Speech.VoiceQuality.Enhanced || id.includes('enhanced')
            ? 'Enhanced'
            : 'Default';
        return { id: best.identifier, name: best.name, quality };
      })
      .catch(() => null);
    cache.set(lang, found);
  }
  return found;
}

// Voices can be downloaded while the app runs; call this when it comes back.
export function forgetVoices() {
  cache.clear();
}
