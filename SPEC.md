# Wordloop: Spec and Build Plan

Working name "Wordloop". Rename freely.

An interactive vocabulary app for advanced learners. Users scroll through a feed of words, save them into sets for a purpose ("Debate", "Analytical essays"), and saved words come back in the feed as recall questions that the user answers by voice or text, graded by an AI coach.

Built for **RevenueCat Shipaton 2026, Next Gen Award** (student category).

---

## 0. Instructions for the coding agent

Read this whole file before writing code. Then work **one phase at a time** (section 9) and stop after each phase.

1. **The owner is a beginner.** After each phase, explain in plain language what you built, which files changed, and exactly how to test it on the phone or emulator.
2. **Never commit secrets.** The OpenRouter key and the RevenueCat secret key (`sk_...`) never go in code or git. Keep them only in `.env` files that are listed in `.gitignore`, or in Cloudflare secrets. Check `git status` before every commit.
3. **Keep it simple.** Prefer fewer libraries and fewer files. Do not add features that are not in this spec.
4. **Use TypeScript** everywhere.
5. **Commit and push** to GitHub after every phase that works, with a clear message.
6. If something in this spec is impossible or clearly wrong, stop and say so instead of guessing.

## 1. Competition constraints (must hold at submission)

- The app is a mobile app for iOS and Android. It is new, created in the submission window.
- It uses the **RevenueCat SDK** for at least one purchase flow. For Next Gen, Test Store is fine.
- The code lives in a **public GitHub repository** with an **MIT `LICENSE` file** and a `README.md` containing setup instructions.
- A **demo video under 2 minutes** (public or unlisted YouTube) shows the app running on a device, with narration covering core features and the purchase flow.
- **Deadline:** Wednesday, September 30, 2026, 11:45 PM PT (Thursday, October 1, 08:45 Swiss time). Target submission is Wednesday evening.

Next Gen judging criteria: a clear, useful, original idea, meaningful progress toward a working app, thoughtful RevenueCat use, and care in technical choices and presentation.

## 2. Tech stack

| Area | Choice |
|---|---|
| Framework | Expo (latest SDK), React Native, TypeScript |
| Navigation | Expo Router, with tabs: Feed, Sets, Settings |
| Local storage | `@react-native-async-storage/async-storage` |
| Purchases | `react-native-purchases`, `react-native-purchases-ui` (RevenueCat paywall) |
| Voice | `expo-audio` to record (works in Expo Go) + Whisper transcription on the Worker |
| Notifications (stretch) | `expo-notifications`, local only |
| AI backend | Cloudflare Worker calling OpenRouter |
| RevenueCat setup help | RevenueCat AI Toolkit plugin (MCP) |

### Development environment

- The owner uses **Windows** and an **iPhone**. There is no Mac, no Android device, and no paid Apple Developer account.
- **Everything runs in Expo Go on the iPhone.** Do not add any library that needs a development build (no custom native modules). Check each new package's "Included in Expo Go" status before installing.
- RevenueCat detects Expo Go and runs in Preview API mode. RevenueCat states that **Test Store also works on Expo Go**, so Test Store purchases are the purchase flow. Verify this early in Phase 4.
- The demo video is a screen recording of the iPhone running the app in Expo Go.

## 3. Content model

### Languages, levels, categories

- **Learning language:** English, French, German, Spanish, Portuguese (`en fr de es pt`).
- **Native language:** the same five. It must differ from the learning language. It is used for translations and AI feedback.
- **Levels:** B1, B2, C1, C2.
- **Categories:** `academic` (essays, analysis), `debate` (argument, persuasion), `idioms`.

### Dataset size

12 words per (language, level, category) gives 5 × 4 × 3 × 12 = **720 entries**. If generation or checking runs late, cut to 8 per combination (480 entries).

### Word entry schema

One JSON file per learning language: `data/words/<lang>.json`, an array of:

```json
{
  "id": "en-c1-debate-004",
  "lang": "en",
  "level": "C1",
  "category": "debate",
  "word": "untenable",
  "partOfSpeech": "adjective",
  "definition": "Not able to be defended against criticism or attack.",
  "example": "Once the data was published, the minister's position became untenable.",
  "translations": {
    "fr": { "word": "intenable", "definition": "Qui ne peut pas être défendu face aux critiques." },
    "de": { "word": "unhaltbar", "definition": "Nicht gegen Kritik zu verteidigen." },
    "es": { "word": "insostenible", "definition": "Que no se puede defender frente a las críticas." },
    "pt": { "word": "insustentável", "definition": "Que não pode ser defendido contra críticas." }
  }
}
```

`definition` and `example` are in the learning language. `translations` covers the other four languages.

### Generation and checking

1. Write `scripts/generate-words.ts`. It calls OpenRouter using `OPENROUTER_API_KEY` from a local `.env`, with **model A** for generation. It produces the JSON above in batches of 12 per combination. The prompt must request words that are really at that CEFR level, have no duplicates, and use original example sentences.
2. Write `scripts/check-words.ts`. It uses a **different model B** to review every entry. It checks the definition, example usage, level fit, and each translation. It **flags** problems with a reason and does not rewrite anything. Output goes to `data/review/flags.json`.
3. The owner reviews all flagged entries, plus 20 random entries in each language they can read. Fix or delete bad entries.
4. The app loads the JSON bundled inside the app. It never generates words at runtime.

Validate the files with a small script: every field present, IDs unique, no empty strings.

## 4. Features (MVP)

### 4.1 Onboarding (first launch)
- The user picks the learning language, native language, level, and one or more categories.
- Choices are saved locally and can be edited in Settings.
- **Done when:** after restarting the app, onboarding is skipped and the choices persist.

### 4.2 Word feed
- Vertical, full-screen, swipe-to-scroll feed, one card per word.
- Each card shows the word, part of speech, level badge, definition, example sentence, and the translation into the native language.
- Buttons: **Heart** (save to the default "Favorites" set) and **Add to set** (a sheet listing sets, with a "+ New set" option).
- The feed is filtered by the current settings, and the order is shuffled.
- **Done when:** scrolling is smooth through 100+ cards and saving works.

### 4.3 Sets
- The Sets tab lists sets with a word count. Tapping a set opens its word list.
- The user can create, rename, and delete sets, and remove a word from a set.
- A word can be in several sets. "Favorites" always exists.
- **Done when:** sets and their contents survive an app restart.

### 4.4 Review cards in the feed
- Every **5th card** in the feed is a review card for a saved word that is due, if one exists.
- The review card asks: "What does **X** mean? Use it in a sentence."
- The user answers by voice (4.6) or text. With AI Coach available, the answer is graded (4.5). Otherwise the user taps **Reveal** and rates themselves **Knew it** or **Didn't**.
- **Scheduling (Leitner boxes):** Box 1 is due after 5 more cards. Box 2 is due after 1 day, box 3 after 3 days, and box 4 after 7 days. A correct answer moves the word up one box. A wrong answer moves it back to box 1.
- **Done when:** a saved word reliably reappears as a review card and its box changes with the answer.

### 4.5 AI Coach (grading)
- The app sends the answer to the Worker (section 6) and shows the verdict, a short piece of feedback in the native language, and an improved example sentence.
- The verdict counts as correct or wrong for the Leitner schedule. A "partly" verdict counts as correct.
- **Free:** 3 AI checks per day. **Pro:** up to 50 per day.
- On a network error, fall back to Reveal plus self-rating.

### 4.6 Voice answers
- A microphone button on the review card records the answer with `expo-audio` (tap to start, tap to stop, max 30 seconds). Ask for microphone permission on first use.
- The recording is sent to the Worker's `/transcribe` endpoint (section 6). The transcript fills the text box, and the user can edit it before submitting for grading.
- Show a short "Transcribing…" state. On failure, keep the text box so the user can type instead.

### 4.7 Settings
- Edit languages, level, and categories.
- Show Pro status. **Restore purchases** button. Link to the paywall.

## 5. Monetization (RevenueCat)

### Free vs Pro

| | Free | Pro |
|---|---|---|
| Levels | B1, B2 | B1 to C2 |
| Categories | Academic, Debate | plus Idioms |
| Sets | Favorites + 2 custom | Unlimited |
| AI Coach checks | 3 per day | 50 per day |

Locked content appears in the feed as a blurred teaser card with a lock icon. Tapping it opens the paywall. This is the main conversion moment, so it should be clear in the demo video.

### RevenueCat configuration

Use the RevenueCat AI Toolkit MCP where possible.

- Create a project and a **Test Store** app.
- Entitlement: `pro`.
- Products: `pro_monthly` (CHF/USD 3.99) and `pro_annual` (CHF/USD 24.99), both attached to `pro`.
- Offering: `default`, with both packages.
- Paywall: build it in the RevenueCat dashboard and show it with `react-native-purchases-ui`.
- The app configures the SDK once at startup with the **Test Store public API key** from `EXPO_PUBLIC_REVENUECAT_API_KEY`. Pro status is `customerInfo.entitlements.active.pro`, and the app listens for customer info updates.
- Include restore purchases.

A comment in the code and a line in the README must say that the Test Store key is replaced with platform keys before any store release.

## 6. AI Coach backend (Cloudflare Worker)

Folder `worker/`, deployed with Wrangler. Secrets are set with `wrangler secret put OPENROUTER_API_KEY`. The model name comes from an environment variable, and the choice is a cheap, fast model.

**`POST /check`** request body:

```json
{ "deviceId": "uuid", "isPro": false, "learningLang": "en", "nativeLang": "de",
  "word": "untenable", "definition": "…", "answer": "It means you can't defend it…" }
```

Response:

```json
{ "verdict": "correct | partly | incorrect",
  "feedback": "Max 2 sentences, in nativeLang.",
  "improvedSentence": "One natural example sentence in learningLang.",
  "remainingToday": 2 }
```

Rules:

- Reject answers over 500 characters and unknown languages.
- Keep a daily count per `deviceId` in Cloudflare KV. The limit is 3, or 50 when `isPro` is true. Return HTTP 429 when the limit is reached.
- Ask the model for strict JSON and validate it before returning.
- Do not log answers.
- `deviceId` is a random UUID stored locally in the app. The app's Worker URL comes from `EXPO_PUBLIC_COACH_URL`.
**`POST /transcribe`**: accepts the recorded audio (max 30 seconds, max about 2 MB) plus `deviceId` and `learningLang`. It transcribes with Cloudflare Workers AI Whisper (`@cf/openai/whisper`), which runs inside the same Worker and needs no extra key. It returns `{ "text": "..." }`. Apply a daily limit per `deviceId` (for example 60 per day). Do not store audio.

- **Known limitation, to note in the README:** the client sends `isPro` itself, so it can't be fully trusted. That is acceptable for a hackathon. A production version would verify it through RevenueCat's REST API or webhooks.

## 7. Stretch (only if Phases 1 to 6 are done)

- **Daily reminder:** a local notification at a time the user picks, such as "3 words are waiting for review".
- **Streak counter** on the feed header.

## 8. Out of scope

Dynamic Island and Live Activities (they need native Swift on a Mac), development builds and any library not included in Expo Go, user accounts or cloud sync, generating words at runtime, a web version, and store release.

## 9. Build phases

| Day | Phase | Goal | Test |
|---|---|---|---|
| Thu 24 | 0. Setup | Create the Expo app, git, and a public GitHub repo with an MIT license. Set up `.gitignore` with `.env`. Install the RevenueCat AI Toolkit. | The app opens in Expo Go on the phone. |
| Fri 25 | 1. Feed | Onboarding, the feed with about 15 hand-written sample words, and Settings. | Scroll, change settings, restart. |
| Sat 26 | 2. Sets and review | Sets, saving, review cards, Leitner scheduling. | Save 3 words and see them come back as reviews. |
| Sat 26 | 3. Content | Generate and check the dataset, review the flags, load the real data. | The feed shows real words for each language. |
| Sun 27 | 4. RevenueCat | Configure Test Store, the paywall, gating, restore, and locked teaser cards. | In Expo Go on the iPhone, a **Test Store purchase unlocks Pro**. If it does not, stop and report before continuing. |
| Mon 28 | 5. AI Coach | Deploy the Worker and connect typed answers to grading. | Answers get graded, and the limit returns 429. |
| Tue 29 | 6. Voice | Record with `expo-audio`, transcribe on the Worker. | A spoken answer is transcribed and graded. |
| Tue 29 | 7. Buffer | Fix whatever broke in Phases 4 to 6. | |
| Tue 29 | 8. Polish and stretch | Visual polish, empty states, error states, reminders if time allows. | A full run with no crashes. |
| Wed 30 | 9. Submit | README, screenshots, demo video, Devpost submission. | Everything on the checklist below. |

If behind schedule, cut in this order: reminders, then voice, then shrink the dataset to 8 per combination. **Never cut the RevenueCat purchase flow.**

## 10. Submission checklist

- [ ] The GitHub repo is public, with an MIT `LICENSE`, and contains no secrets. Search the repo for `sk_` and `OPENROUTER`.
- [ ] The README covers what the app is, features, the tech stack, setup steps, environment variables (with example values only), how RevenueCat is used, and known limitations.
- [ ] `.env.example` files exist for the app, the scripts, and the worker.
- [ ] The demo video is under 2 minutes and public or unlisted. It shows onboarding, the feed, saving to a set, a review card answered by voice with AI feedback, hitting a locked card, the paywall, a Test Store purchase, and Pro unlocking.
- [ ] The Devpost description is written by the owner, not by AI.
- [ ] The Next Gen category is selected, and the student email is verified.
- [ ] Submitted before Wednesday evening.
