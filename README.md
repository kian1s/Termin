# Termin

**Words worth knowing, one card at a time.** Termin is a vocabulary app for learners at B1 to C2 in English, French, German, Spanish and Portuguese. You scroll a feed of word cards, save the ones you want, and they come back as review cards at the right time. An AI tutor grades your answers, and a set of AI tools helps you learn from what you write, read and see.

Built with Expo for the RevenueCat Shipaton 2026 (Next Gen).

## Features

**Learning**
- **Word feed:** 2,747 checked word cards (Academic, Everyday, Work, Idioms) at your level, with definition, example, and a translation that stays blurred until you tap it. Strong learners get "stretch" words from the level above.
- **Review cards in the feed:** saved words come back as questions, spaced with Leitner boxes (New, Learning, Familiar, Learned). Answer by typing or speaking.
- **Tutor:** grades your answer (the meaning; an optional sentence is checked too) and suggests a better sentence.
- **Natural voices:** every word and example recorded with Azure neural voices, cached on the phone.
- **Sets and flashcards**, a level test, history, progress with streaks, and reminders.

**AI tools**
| Tool | What it does |
|---|---|
| Say it better | Rewrites your sentence with stronger words from Termin's own dataset, which you can save |
| Describe it | A speaking game: describe a saved word without saying it, and Tutor guesses it |
| Explain it differently | On any card: an easier explanation or another example |
| Snap a word | A word at your level from any photo |
| Words from a text | Words worth learning from a link, photos of pages, or pasted text |
| Add my own word | Termin's card if it has the word; otherwise write it yourself or with AI |
| AI reminders | Picks the saved words that most need practice, writes the reminder, and a tap opens a 1-minute test |

## Free and Premium (RevenueCat)

| | Free | Premium ($4.99/month or $49.99/year) |
|---|---|---|
| Words | Academic and Everyday: all of B1 and B2, part of C1 and C2. Idioms and Work: a few samples | Every word and category |
| Tutor checks | 3 a day | 50 a day |
| Explain it differently | 1 a day | 30 a day |
| Snap a word | 2 photos, ever | 10 a day |
| Words from a text | 1 link, 2 photo runs, 2 texts, ever | 3 links, 5 photo runs, 10 texts a day |
| Add my own word with AI | 2 a month | 30 a month |
| Say it better, Describe it, AI reminders, flashcards | Locked | Included |
| Own sets | 2 | Unlimited |

Review in the feed is always free. Uses left are shown as small credit pills.

**How RevenueCat is used**
- `react-native-purchases` is configured once at startup (`src/lib/premium.tsx`). Premium is the `premium` entitlement; the app listens for customer info updates.
- Products `premium_monthly` and `premium_annual` in the `default` offering, set up in a **Test Store** app.
- Expo Go can't render dashboard paywalls, so in Expo Go the app shows its own paywall (`src/app/paywall.tsx`): it loads the current offering and buys with `Purchases.purchasePackage`, which shows RevenueCat's simulated Test Store purchase. Native builds use `RevenueCatUI.presentPaywallIfNeeded`.
- Restore purchases is on the paywall and in Settings. Locked words in the feed ("You're ready for C1") are the main upgrade moment.

## Tech stack

- **App:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript. Runs in Expo Go. State in AsyncStorage (no accounts).
- **Backend:** one Cloudflare Worker (`worker/`) with KV for daily limits, Workers AI Whisper for voice answers, and OpenRouter (GPT-6 Luna Pro) for every AI feature. It also serves the voice clips.
- **Content:** `scripts/dataset` wrote the words with one model (GPT-6 Luna Pro), checked them with a second from another company (Gemini 3.8 Flash) plus a Wiktionary originality check, and every flag was reviewed by hand; `scripts/voices` recorded the audio with Azure.
- Expo modules: expo-audio, expo-notifications, expo-image-picker, expo-image-manipulator, expo-clipboard, expo-haptics, expo-blur, react-native-svg.

## Setup

```bash
npm install
cp .env.example .env        # then fill in the values below
npx expo start              # open in Expo Go on your phone
```

**App environment (`.env`)**
| Variable | Example |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_API_KEY` | `test_your-key-here` (RevenueCat Test Store public key) |
| `EXPO_PUBLIC_COACH_URL` | `https://termin-coach.<you>.workers.dev` |
| `OPENROUTER_API_KEY` | scripts only: `sk-or-v1-your-key-here` |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | scripts only: voice recording |

**Worker**
```bash
cd worker
npm install
npx wrangler kv namespace create COACH_KV   # put the id in wrangler.jsonc
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy
```
For local development, copy `worker/.dev.vars.example` to `worker/.dev.vars`. The voice clips (about 150 MB) are not in the repo; generate them with `node scripts/voices/generate.ts` into `worker/public/audio` before deploying. Without them the app uses the phone's voice.

Checks: `npx tsc --noEmit` and `npx expo lint`.

## Known limitations

- **Premium is trusted from the app.** The app tells the Worker whether the user is Premium. A production version would verify it with RevenueCat's REST API or webhooks.
- **Free limits are per install.** They're tied to a random device ID, so reinstalling resets them.
- **Test Store only.** The RevenueCat key is the Test Store key; it's replaced with Apple and Google keys before any store release.
- **Expo Go limits:** notifications are local only, and there is no share extension (sharing an article from Safari into Termin needs a native build).
- **AI output can be wrong.** Word cards were checked by a second model and reviewed, but Tutor feedback and AI-made cards are hints, not final answers. AI-made cards are marked AI.

## Privacy and license

Termin has no accounts; learning data stays on the phone. What the AI features send to the server is listed in [PRIVACY.md](PRIVACY.md). Terms: [TERMS.md](TERMS.md). Code under the [MIT license](LICENSE).
