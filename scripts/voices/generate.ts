/// <reference types="node" />
// Records natural pronunciations for every word and example sentence with
// Azure neural voices (SPEC 4.11 step 2), into worker/public/audio/<lang>/.
// The Worker serves them as static assets. Run from the project root:
//
//   node scripts/voices/generate.ts            all languages
//   node scripts/voices/generate.ts en de      only these
//
// Needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in .env. Existing files are
// skipped, so it can be rerun after a crash or when words are added.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { Lang, WordEntry } from '../../src/lib/types.ts';

// One regional neural voice per language, matching the app's speech locales.
const VOICES: Record<Lang, [locale: string, voice: string]> = {
  en: ['en-US', 'en-US-AvaNeural'],
  fr: ['fr-FR', 'fr-FR-DeniseNeural'],
  de: ['de-DE', 'de-DE-KatjaNeural'],
  es: ['es-ES', 'es-ES-ElviraNeural'],
  pt: ['pt-PT', 'pt-PT-RaquelNeural'],
};
const ROOT = new URL('../../', import.meta.url);
const OUT = new URL('worker/public/audio/', ROOT);
const PARALLEL = 4;

process.loadEnvFile(new URL('.env', ROOT));
const KEY = process.env.AZURE_SPEECH_KEY?.trim();
const REGION = process.env.AZURE_SPEECH_REGION?.trim();
if (!KEY || !REGION) throw new Error('AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are needed in .env');

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function synthesize(lang: Lang, text: string): Promise<Buffer> {
  const [locale, voice] = VOICES[lang];
  const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://${REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'termin-voices',
      },
      body: ssml,
    });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // Free tier rate limit: wait as long as Azure asks, then retry.
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const wait = Number(res.headers.get('retry-after')) || 5 * attempt;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`Azure ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

const langs = (process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VOICES)) as Lang[];
let made = 0;
let skipped = 0;
let chars = 0;

for (const lang of langs) {
  const words = JSON.parse(readFileSync(new URL(`data/words/${lang}.json`, ROOT), 'utf8')) as WordEntry[];
  const dir = new URL(`${lang}/`, OUT);
  mkdirSync(dir, { recursive: true });
  // "-w" is the headword, "-e" the example sentence.
  const jobs = words.flatMap((w) => [
    { file: new URL(`${w.id}-w.mp3`, dir), text: w.word },
    { file: new URL(`${w.id}-e.mp3`, dir), text: w.example },
  ]);
  let next = 0;
  await Promise.all(
    Array.from({ length: PARALLEL }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        if (existsSync(job.file)) {
          skipped++;
          continue;
        }
        writeFileSync(job.file, await synthesize(lang, job.text));
        chars += job.text.length;
        made++;
        if (made % 200 === 0) console.log(`  ${made} recorded…`);
      }
    })
  );
  console.log(`${lang}: ${jobs.length} clips ready`);
}
console.log(`Done: ${made} recorded, ${skipped} already there, about ${chars} characters used.`);
