# Termin: Spec and Build Plan

App name: **Termin** (renamed from the working name "Wordloop" in Phase 4). The paid tier is **Termin Premium**.

An interactive vocabulary app for advanced learners. Users scroll through a feed of words, save them into sets for a purpose ("Debate", "Analytical essays"), and saved words come back in the feed as recall questions that the user answers by voice or text, graded by an AI coach.

Built for **RevenueCat Shipaton 2026, Next Gen Award** (student category).

---

## 0. Instructions for the coding agent

**Design:** all UI follows `DESIGN.md` (feel, theme, colors, fonts, card layouts). Read it together with this file before building any screen.

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
| Navigation | Expo Router, with tabs: Feed, Sets, Practice, Progress, Settings |
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
- **Native language:** the same five. It may be the same as the learning language (for example a native English speaker building advanced English vocabulary); cards then show no translation. It is used for translations and, by default, AI feedback.
- **Levels:** B1, B2, C1, C2.
- **Categories:** `academic` (essays, analysis, argument, linking words; includes the former Debate words), `everyday` (natural conversation, collocations, phrasal verbs, register), `work` (meetings, emails, negotiation), `idioms` (fixed expressions with a non-literal meaning). Debate was dropped as a category in Phase 3; learners can build a Debate set instead. Details in `DATASET.md`.

### Dataset size

Up to **475 words per language** (2,375 in total). Each number is a **cap**, not a quota: the generator returns fewer rather than invent filler, and the checker drops weak entries. The caps are the same for all five languages.

| Category | B1 | B2 | C1 | C2 | Total |
|---|---|---|---|---|---|
| Academic | 25 | 40 | 40 | 30 | 135 |
| Everyday | 30 | 40 | 35 | 25 | 130 |
| Work | 20 | 30 | 30 | 20 | 100 |
| Idioms | 15 | 30 | 35 | 30 | 110 |
| **Total** | **90** | **140** | **140** | **105** | **475** |

If review runs late, ship the entries that already passed.

### Word entry schema

One JSON file per learning language: `data/words/<lang>.json`, an array of:

```json
{
  "id": "en-c1-academic-004",
  "lang": "en",
  "level": "C1",
  "category": "academic",
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

The full plan, models and cost limits are in `DATASET.md`. Scripts live in `scripts/dataset/` and run with Node on the owner's PC, never in the app.

1. **Pick candidate words** (model A): bare words, 1.5× the cap per combination.
2. **Filter** (model B scores level and category fit; a script removes repeats within a language and keeps the cap).
3. **Write entries** (model A): batches of 10, strict JSON, 4 translations.
4. **Script checks:** every field present, no empty strings, unique IDs, no repeated word in a language, the word (or a form of it) in the example, and the definition compared with Wiktionary (a very close match is a serious flag).
5. **Model review** (model B, from a different company than A): flags only, each with a reason and a severity (serious or minor).
6. **Serious flags** get one automatic retry with the reason; still flagged after that, the entry is dropped.
7. **Owner review:** remaining minor flags plus 10 random entries per level, in `data/review/`.
8. **Ship:** `data/words/<lang>.json`, bundled in the app. It never generates words at runtime.

**Writing rules:** common and useful words at their CEFR level; original definitions and examples (never quoted); definitions in simpler words than the headword, under 20 words; examples 8 to 20 words; European Portuguese, Spain Spanish, France French; nouns in German, French, Spanish and Portuguese include their article; idiom translations use an equivalent idiom or a short plain explanation, never word for word.

**Limits:** the OpenRouter key has a $10 limit and the scripts stop at $9.50 of tracked spend (raised from $8 during the full run). Progress is saved per combination so a crash costs nothing already paid for.

## 4. Features (MVP)

### 4.1 Onboarding (first launch)
- The user picks the learning language, native language, level, and one or more categories.
- Choices are saved locally and can be edited in Settings.
- **Done when:** after restarting the app, onboarding is skipped and the choices persist.

### 4.2 Word feed
- Vertical, full-screen, swipe-to-scroll feed, one card per word.
- Each card shows the word, part of speech, level badge, definition, example sentence, and the translation into the native language.
- **Translation visibility:** the translation is always blurred with "Tap to reveal", on word and review cards, so learners try to recall the meaning first. Seen word IDs are still stored locally (for the level-up card).
- **Pronunciation:** a speaker button next to the word reads it aloud with `expo-speech` (works in Expo Go), using the learning language's voice (`en-US`, `fr-FR`, `de-DE`, `es-ES`, `pt-PT`).
- Buttons: **Speaker** (pronunciation), **Heart** (save to the default "Favorites" set) and **Add to set** (a sheet listing sets, with a "+ New set" option).
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
- While a review card is on screen, the feed cannot be swiped until the answer is rated: by the AI Coach after Check, or by the user with Didn't / Knew it after Reveal. Revealing alone does not unlock it.
- The user answers by voice (4.6) or text. With AI Coach available, the answer is graded (4.5). Otherwise the user taps **Reveal** and rates themselves **Knew it** or **Didn't**.
- **Scheduling (Leitner boxes):** Box 1 is due after 5 more cards. Box 2 is due after 1 day, box 3 after 3 days, and box 4 after 7 days. A correct answer moves the word up one box. A wrong answer moves it back to box 1.
- **Done when:** a saved word reliably reappears as a review card and its box changes with the answer.

### 4.5 AI Coach (grading)
- The app sends the answer to the Worker (section 6) and shows the verdict, a short piece of feedback in the native language, and an improved example sentence.
- The verdict counts as correct or wrong for the Leitner schedule. A "partly" verdict counts as correct.
- **Free:** 3 AI checks per day. **Premium:** up to 50 per day.
- On a network error, fall back to Reveal plus self-rating.

### 4.6 Voice answers
- A microphone button on the review card records the answer with `expo-audio` (tap to start, tap to stop, max 30 seconds). Ask for microphone permission on first use.
- The recording is sent to the Worker's `/transcribe` endpoint (section 6). The transcript fills the text box, and the user can edit it before submitting for grading.
- Show a short "Transcribing…" state. On failure, keep the text box so the user can type instead.

### 4.7 Progress
- A **Progress** tab (tabs become Feed, Sets, Progress, Settings).
- Shows: words seen, words saved, words learned (reached box 4), a bar showing how many saved words are in each Leitner box (1 to 4), reviews answered today, and the current and best streak.
- All numbers are computed from local data. No accounts.
- **Done when:** saving and reviewing words visibly changes the numbers, and they survive a restart.

### 4.8 Streak
- A day counts toward the streak when the user answers at least one review card or views at least 10 cards that day.
- The current streak shows as a small flame and number in the feed header, and on the Progress tab. Missing a full day resets it to 0. Best streak is kept.
- **Done when:** the streak increases on a new day with activity (test by changing the stored last-active date) and resets after a missed day.

### 4.9 Daily reminder
- In Settings: a toggle and a time picker for a daily local notification.
- Uses `expo-notifications`, **local notifications only**. Ask for permission when the toggle is first turned on. Verified in Phase 1: local notifications arrive on the iPhone lock screen in Expo Go. They do not show while the app is open, which is acceptable.
- **Smart reminders (added after Phase 1):**
  - Instead of one repeating notification, schedule each of the next 7 days individually (one-time date triggers). Reschedule all of them every time the app opens, and whenever the reminder settings change.
  - **Randomized time:** each day's reminder fires at a random minute within ±30 minutes of the time the user picked (clamped to the same day).
  - **A word in every reminder:** each notification quizzes one word, such as "Do you remember what *untenable* means?". Prefer a saved word (due for review first, then any saved word). If nothing is saved, use a new word from the user's feed filters that they have not seen yet, such as "New word: *specious*. Do you know what it means?". Do not repeat the same word within the 7 scheduled days when enough words exist.
  - Tapping the notification opens the app on the feed.
- **Done when:** a reminder set 2 minutes ahead arrives on the iPhone, and the scheduled reminders for the coming days contain different words.

### 4.10 Settings
- Edit languages, level, and categories.
- Show Premium status. **Restore purchases** button. Link to the paywall.

### 4.11 Natural pronunciation
- The speaker button should sound as human as possible instead of the default robotic voice.
- **Step 1 (on-device, Phase 8):** with `expo-speech`, list the available voices for the learning language and pick the best quality one (Premium, then Enhanced, then default). In Settings, show a short hint explaining that better voices can be downloaded for free in iOS Settings → Accessibility → Spoken Content → Voices.
- **Step 2 (optional, after Phase 6 if time allows):** a `POST /speak` endpoint on the Worker that returns natural AI-generated speech for a word, played with `expo-audio`, with caching and a daily limit per `deviceId`. Fall back to on-device speech on any error.
- **Done when:** with an Enhanced or Premium voice installed, the word is read with that voice.

### 4.12 Blending stretch words (Phase 4)
- Learners who do well get "stretch" cards from one level up, from the categories they picked, decided on the phone from the Leitner boxes and recent review answers.

| Learner state | Rule (last 20 reviews) | Feed |
|---|---|---|
| Normal | Default | Only the chosen level |
| Ready | 80%+ correct and 15+ words in box 3 or higher | 1 stretch card in every 8 |
| Strong | 90%+ correct | 1 stretch card in every 5 |
| Running out | 80% of the level's words seen | One-time card: "You're ready for C1. Switch level?" |
| Struggling | Under 60% correct | No stretch cards until accuracy recovers |

- Stretch cards show a small **Stretch · C1** badge. Saving and reviewing work as normal.
- If the learner is ready but the level above has locked words, those words become locked teasers ("You're ready for C1") that open the paywall, at most one per 15 cards.
- A development-only Settings row, "Simulate strong learner", makes it testable.
- **Done when:** with "Simulate strong learner" on, stretch cards appear at the expected rate, and a free B2 learner sees locked C1 teasers.

### 4.13 History (Phase 8)
- A **clock button** (Ionicons `time-outline`, `textSecondary`) in the feed header, left of the streak, opens `src/app/history.tsx` as a pushed screen titled "History".
- The list shows every word card that has appeared in the feed, **newest first**: the word (Fraunces, about 20 pt) and its definition (system font, 15 pt, `textSecondary`, max 2 lines). Nothing else on the row, per the owner's request.
- Rows are grouped under small uppercase headers: **Today**, **Yesterday**, then the date (e.g. "Mon 28 Sep"). Words seen before this feature existed have no time and go under **Earlier** at the bottom.
- Data: add `seenAt: Record<string, number>` (word ID → last time its card was on screen) to the stored app state, written at the same moment a word is marked seen. Only word cards count, not review or locked teaser cards. Old installs keep working (missing map = empty).
- Tapping a row opens the existing add-to-set sheet for that word (`/add-to-set/[wordId]`), so a word you scrolled past can still be saved.
- Empty state: "Words you see in the feed will appear here."
- **Done when:** after scrolling 5 cards, History lists those 5 words newest first under Today, and the list survives a restart.

### 4.14 Level test (Phase 8)
- A short offline quiz that suggests a CEFR level. No AI and no network.
- **Entry points:** a "Not sure? Take a 2-minute test" link under the options on the onboarding level step, and a **Find my level** row in Settings (in the section with the level).
- **Format:** 12 questions, 3 per level from B1 to C2, in the learning language, presented in that order. Each question shows one word (Fraunces, large) and **4 definitions** to pick from (the right one plus 3 from other words of the same level and language), plus an **"I don't know"** option to discourage guessing. Words are picked at random from the whole dataset, **ignoring Premium gating** (the test only shows the word and definitions). Test words are **not** marked as seen.
- A thin progress bar at the top (`accent`). Tapping an option shows right/wrong for about 600 ms, then moves on. No going back.
- **Scoring** (pure function in `src/lib/level-test.ts`): a level is passed with at least 2 of 3 correct. The suggested level is the highest level reached by passing every level below it too, starting from B1. If B1 is not passed, suggest B1.
- **Result screen:** "Your level: **C1**" in Fraunces, a one-line explanation, and 4 small rows showing the score per level (e.g. B2 3/3). Buttons: **Use C1** (`accent`, saves the level) and **Keep B2** (text button). From onboarding, "Use" continues to the next onboarding step.
- **Done when:** answering everything right suggests C2, everything wrong suggests B1, and "Use" changes the feed level.

### 4.15 Premium flashcards (Phase 8)
- A **Study flashcards** button at the top of a set's word list (`src/app/set/[id].tsx`), disabled with a hint when the set is empty.
- **Premium only.** For free users the button uses `premium` colors with a small lock icon and a PREMIUM badge; tapping it opens the paywall. For Premium users it opens `src/app/flashcards/[setId].tsx`.
- **Card front:** the word (Fraunces, large), part of speech, and the speaker button. **Tap to flip** (a 250 ms flip or crossfade, per DESIGN.md motion rules). **Back:** definition, example sentence, and the translation (not blurred here).
- Two buttons under the flipped card: **Didn't know** and **Knew it**. They update the word's Leitner box exactly like self-rating on a review card (reuse the same function), and count as a review for `reviewsToday` and the streak.
- **Order:** due words first, then lower boxes first, shuffled within each group. A small counter at the top ("4 / 12").
- **End screen:** "12 cards · 9 known", how many words are now in each box, and buttons **Study again** and **Done**.
- Add a Flashcards row (Premium only) to the Free vs Premium table (section 5) and a flashcards line to the paywall benefits list.
- **Done when:** a free user hits the paywall from the button; after a Test Store purchase the same button opens flashcards, and "Knew it" moves a word up one box.

### 4.16 Notification options (Phase 8)
- The "Daily reminder" section in Settings becomes one row, **Reminders**, that opens `src/app/reminders.tsx` (native grouped list). Everything stays local notifications (4.9).
- Options:
  - **Reminders** on/off (existing permission flow).
  - **Times:** 1 to 3 times per day, each with its own time picker. "Add a time" / swipe or tap to remove. Default: one time, 19:00.
  - **Days:** seven weekday chips (M T W T F S S), default all on. No reminders on days that are off.
  - **Include a word:** on (default) = the current quiz text with a word; off = a plain nudge such as "A few new words are waiting for you."
  - **Vary the time slightly:** on (default) = the existing ±30 minute randomization; off = exact times.
  - **Streak saver:** when on and the streak is 2 or more, schedule one extra notification today at 21:00, "Keep your 5-day streak. One card is enough." Cancel it as soon as today counts toward the streak (4.8) and never schedule it for a day that already counts.
- Data: extend `Reminder` to `{ enabled, times: {hour, minute}[], days: number[], includeWord, vary, streakSaver }`. Migrate the old `{ enabled, hour, minute }` shape on load. The 7-day scheduler in `src/lib/reminder.ts` loops over days and times; words must not repeat across all scheduled notifications while enough words exist.
- All options are free.
- **Done when:** with two times and only today's weekday on, exactly two reminders are scheduled for today and none for the other days; the streak saver disappears after answering a card.

## 5. Monetization (RevenueCat)

### Free vs Premium

| | Free | Premium |
|---|---|---|
| Levels | All levels (B1 to C2) | All levels |
| Words | All B1 and B2; 2/3 of C1 Everyday, 1/4 of C1 Academic; half of C2 Academic and Everyday | Every word |
| Categories | Academic, Everyday, plus 3 fixed sample words of Idioms and Work per level | plus Idioms and Work |
| Sets | Favorites + 2 custom | Unlimited |
| AI Coach checks | 3 per day | 50 per day |
| Flashcards for sets (4.15) | No | Yes |

The free share is fixed (the first words of each language, category and level group), so free users always see the same words. Locked words appear in the feed as a blurred teaser card with a lock icon, at most one in every 15 cards. Tapping it opens the paywall. This is the main conversion moment, so it should be clear in the demo video.

### RevenueCat configuration

Use the RevenueCat AI Toolkit MCP where possible.

- Create a project and a **Test Store** app.
- Entitlement: `premium`.
- Products: `premium_monthly` (USD 4.99) and `premium_annual` (USD 49.99), both attached to `premium`.
- Offering: `default`, with both packages.
- Paywall: build it in the RevenueCat dashboard and show it with `react-native-purchases-ui`. **Expo Go cannot render dashboard paywalls** (Preview API mode shows only a placeholder), so in Expo Go the app opens its own paywall screen (`src/app/paywall.tsx`). It loads the current offering from RevenueCat and buys with `Purchases.purchasePackage`, which in Expo Go shows RevenueCat's simulated Test Store alert. Native builds use the dashboard paywall.
- The app configures the SDK once at startup with the **Test Store public API key** from `EXPO_PUBLIC_REVENUECAT_API_KEY`. Premium status is `customerInfo.entitlements.active.premium`, and the app listens for customer info updates.
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
**`POST /transcribe`**: accepts the recorded audio (max 30 seconds, max about 2 MB) plus `deviceId` and `learningLang`. It transcribes with Cloudflare Workers AI Whisper (`@cf/openai/whisper-large-v3-turbo`, with the learning language and the reviewed word as hints, so the key word is spelled correctly), which runs inside the same Worker and needs no extra key. It returns `{ "text": "..." }`. Apply a daily limit per `deviceId` (for example 60 per day). Do not store audio.

- **Known limitation, to note in the README:** the client sends `isPro` itself, so it can't be fully trusted. That is acceptable for a hackathon. A production version would verify it through RevenueCat's REST API or webhooks.

## 7. Stretch

Only if time is left after Phase 9. Daily reminder and streak moved into the MVP (4.8 and 4.9).

- **Real-time voice transcription.** Option A: stream live microphone PCM (`expo-audio` `useAudioStream`, works in Expo Go) over a WebSocket to the Worker, which relays it to Workers AI Deepgram Nova-3 for word-by-word text (about 2 to 3 hours, uses more of the free Cloudflare allowance). Option B: keep Whisper but re-send the audio so far every 2 to 3 seconds while recording (about 1 hour). On-device iOS speech recognition needs a native build, so it is out for Expo Go.
- **Production app version.** Per-platform RevenueCat keys (Test Store key only in Expo Go), the dashboard paywall in native builds, the Worker verifying Premium through RevenueCat's REST API plus a global daily cap, `eas.json` build profiles, and an iOS bundle ID and Android package name.

## 8. Out of scope

Dynamic Island and Live Activities (they need native Swift on a Mac), development builds and any library not included in Expo Go, user accounts or cloud sync, generating words at runtime, a web version, and store release.

## 9. Build phases

| Day | Phase | Goal | Test |
|---|---|---|---|
| Thu 24 | 0. Setup | Create the Expo app, git, and a public GitHub repo with an MIT license. Set up `.gitignore` with `.env`. Install the RevenueCat AI Toolkit. | The app opens in Expo Go on the phone. |
| Fri 25 | 1. Feed | Onboarding, the feed with about 15 hand-written sample words, the translation seen/blurred rule, the pronunciation button, and Settings including the daily reminder (4.9). Follow DESIGN.md. | Scroll, tap the speaker, change settings, restart and see blurred translations on repeat words. |
| Sat 26 | 2. Sets and review | Sets, saving, review cards, Leitner scheduling, the Progress tab, the streak, and smart reminders (4.9). | Save 3 words, see them come back as reviews, and see Progress and the streak update. A reminder quizzes a saved word. |
| Sat 26 | 3. Content | Run the dataset pipeline in `DATASET.md` (test batch first), review the flags, load the real data. | The feed shows real words for each language. |
| Sun 27 | 4. RevenueCat | Configure Test Store, the paywall, gating, restore, locked teaser cards, and blending (4.12). | In Expo Go on the iPhone, a **Test Store purchase unlocks Premium**. If it does not, stop and report before continuing. |
| Mon 28 | 5. AI Coach | Deploy the Worker and connect typed answers to grading. | Answers get graded, and the limit returns 429. |
| Tue 29 | 6. Voice | Record with `expo-audio`, transcribe on the Worker. | A spoken answer is transcribed and graded. |
| Tue 29 | 7. Buffer | Fix whatever broke in Phases 4 to 6. | |
| Tue 29 | 8. Polish and additions | Final colors and app icon (DESIGN.md 3 and 9), then History (4.13), Premium flashcards (4.15), level test (4.14) and notification options (4.16), then visual polish (including onboarding), empty states, error states, natural pronunciation step 1 (4.11). | A full run with no crashes, checked in light and dark mode. |
| Wed 30 | 9. Submit | README, screenshots, demo video, Devpost submission. | Everything on the checklist below. |

If behind schedule in Phase 8, cut in this order: notification options (4.16), then the level test (4.14). Earlier cut order: voice, then blending, then ship a smaller dataset (only entries that passed review). **Never cut the RevenueCat purchase flow.**

## 10. Submission checklist

- [ ] The GitHub repo is public, with an MIT `LICENSE`, and contains no secrets. Search the repo for `sk_` and `OPENROUTER`.
- [ ] The README covers what the app is, features, the tech stack, setup steps, environment variables (with example values only), how RevenueCat is used, and known limitations.
- [ ] `.env.example` files exist for the app, the scripts, and the worker.
- [ ] The demo video is under 2 minutes and public or unlisted. It shows onboarding, the feed, saving to a set, a review card answered by voice with AI feedback, hitting a locked card, the paywall, a Test Store purchase, and Premium unlocking.
- [ ] The Devpost description is written by the owner, not by AI.
- [ ] The Next Gen category is selected, and the student email is verified.
- [ ] Submitted before Wednesday evening.
