# Wordloop: Design Brief

Every screen follows this file. Read it together with SPEC.md before building any UI.

## 1. Feel

**Calm and bookish.** The app should feel like a beautiful dictionary or a Kindle page, not a game. Lots of space, elegant type, quiet colors, and one warm accent. This sets it apart from colorful, gamified language apps and signals "advanced vocabulary".

References:

- **Vocabulary (the app):** one word per screen, quote-card layout, minimal chrome.
- **Kindle / Apple Books:** typography first, calm paper-like surfaces.
- **Apple's own apps:** native iOS behavior, clean lists, bottom sheets, standard tab bar.

Principles:

1. The word is the hero. Everything else is quieter.
2. One accent color, used sparingly: actions, the Pro badge, highlights.
3. Native iOS patterns over custom widgets (sheets, lists, switches).
4. Gentle motion only. Nothing bounces or flashes.

## 2. Theme

**Follow the phone.** Light and dark themes switch automatically with the iPhone setting.

- Use `useColorScheme()` and a single `theme.ts` file exporting color tokens for both modes. Never hard-code colors in components.
- Set `"userInterfaceStyle": "automatic"` in `app.json`.
- Test every screen in both modes before finishing a phase.

## 3. Colors

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FAF7F2` | `#121110` | Screen background (warm paper / warm near-black) |
| `surface` | `#FFFFFF` | `#1C1A18` | Cards, sheets, list rows |
| `text` | `#1C1A17` | `#F2EDE4` | Main text, the word |
| `textSecondary` | `#6B645A` | `#A39B8F` | Part of speech, labels, hints |
| `border` | `#E7E0D5` | `#2E2B27` | Dividers, outlines |
| `accent` | `#B7791F` | `#E0A43A` | Amber/gold: buttons, active icons, Pro |
| `accentSoft` | `#F6E7C8` | `#3A2E1A` | Accent backgrounds, badges, selected chips |
| `correct` | `#3F8F5B` | `#6CC08A` | AI Coach "correct" |
| `partly` | `#B7791F` | `#E0A43A` | AI Coach "partly" (same as accent) |
| `wrong` | `#B4493C` | `#E07A6C` | AI Coach "incorrect", destructive actions |

Gold doubles as the **Pro** color, so everything Pro related (badge, lock icon, paywall button) uses `accent`.

## 4. Typography

- **Fraunces** (Google Font, via `@expo-google-fonts/fraunces` + `expo-font`, both work in Expo Go) for:
  - the featured word on each card (about 44 pt, weight 500 to 600)
  - screen titles (about 28 pt)
  - example sentences (Fraunces Italic, about 18 pt)
- **iOS system font** (SF Pro, no loading needed) for everything else: definitions (17 pt), labels, buttons, lists, settings.
- Small labels such as level and category: system font, 12 pt, uppercase, letter spacing 1, `textSecondary`.
- Line height about 1.4 for body text. Never go below 13 pt.

## 5. Word card (the feed)

Full screen, one card per swipe, content vertically centered with generous side padding (24 pt).

```
  C1 · DEBATE                      (small caps label)

  untenable  🔊                    (Fraunces, large; speaker icon)
  adjective                        (italic, secondary)

  Not able to be defended          (system font, 17 pt)
  against criticism or attack.

  │ "Once the data was published,  (Fraunces Italic,
  │  the minister's position        thin accent bar on
  │  became untenable."             the left)

  ┌─────────────────────────────┐
  │ DE  unhaltbar               │  (surface block,
  │     Nicht gegen Kritik zu   │   translation)
  │     verteidigen.            │
  └─────────────────────────────┘

                          ♡    ＋  (bottom right)
```

**Translation rule (decided by Kian):**

- A word the user sees **for the first time**: translation fully visible.
- A word the user has **already seen** and that comes up again: translation **blurred** (use `expo-blur`, which works in Expo Go) with a small "Tap to reveal" hint. Tapping un-blurs it.
- Store seen word IDs locally (AsyncStorage) so this survives restarts. A word counts as seen once its card has been on screen.

Actions:

- **Speaker** (Ionicons `volume-medium-outline`, `textSecondary`) next to the word: reads it aloud with `expo-speech`. Icon turns `accent` while speaking.
- **Heart** saves to Favorites. Filled amber when saved. Light haptic tap on save (`expo-haptics`, works in Expo Go).
- **Plus** opens a native-style bottom sheet listing sets, with "+ New set" at the top.

## 6. Other card types

- **Review card:** same layout, with a small amber "REVIEW" label at the top and a thin amber outline. Prompt in Fraunces: "What does *untenable* mean? Use it in a sentence." Below it, a text box and a round microphone button. AI feedback appears in a surface block colored by verdict (`correct` / `partly` / `wrong`).
- **Locked teaser card (free users):** the word card blurred behind `expo-blur`, with a centered gold lock icon, a "PRO" badge, and one line such as "Unlock C1 and C2 words". Tapping opens the paywall.

## 7. Other screens

- **Tab bar:** Feed, Sets, Progress, Settings. Icons from `@expo/vector-icons` (Ionicons): `book-outline`, `albums-outline`, `stats-chart-outline`, `settings-outline`. Active tint `accent`.
- **Feed header:** small and quiet. Current streak at the top right as a flame icon plus number in `accent` (e.g. `🔥 4`, using Ionicons `flame`).
- **Progress:** large Fraunces numbers with small uppercase labels (Words learned, Saved, Seen, Reviews today, Streak / Best). One horizontal bar split into Leitner boxes 1 to 4, shaded from `accentSoft` to `accent`. No busy charts.
- **Onboarding:** one question per screen, large Fraunces question, options as large rounded chips (selected: `accentSoft` background, `accent` border). A single amber "Continue" button at the bottom.
- **Sets:** a native grouped list. Each row shows the set name and word count. Favorites is pinned at the top with a heart icon.
- **Settings:** native grouped list (like iOS Settings). A Pro status row with a gold badge, "Restore purchases" and "Upgrade to Pro" rows, and a "Daily reminder" row with a switch and time picker.
- **Paywall:** built in the RevenueCat dashboard. Match the colors above (amber button, warm background) and use the same calm tone.

## 8. Shapes, spacing, motion

- Corner radius: 16 for cards and blocks, 12 for chips and buttons.
- Spacing scale: 4, 8, 12, 16, 24, 32.
- No heavy shadows. Use `surface` plus a hairline `border` instead.
- Motion: short fades (150 to 250 ms) for reveal and blur changes. The feed snaps one card per swipe.

## 9. App icon and name

Decided later (before Phase 8). The icon should be a simple serif letter or mark in amber on the warm background.
