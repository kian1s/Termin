# Termin: Design Brief

Every screen follows this file. Read it together with SPEC.md before building any UI.

## 1. Feel

**Calm and bookish.** The app should feel like a beautiful dictionary or a Kindle page, not a game. Lots of space, elegant type, quiet colors, and one warm accent. This sets it apart from colorful, gamified language apps and signals "advanced vocabulary".

References:

- **Vocabulary (the app):** one word per screen, quote-card layout, minimal chrome.
- **Kindle / Apple Books:** typography first, calm paper-like surfaces.
- **Apple's own apps:** native iOS behavior, clean lists, bottom sheets, standard tab bar.

Principles:

1. The word is the hero. Everything else is quieter.
2. One accent color (green), used sparingly for actions and highlights. A second color (terracotta) marks Premium only.
3. Native iOS patterns over custom widgets (sheets, lists, switches).
4. Gentle motion only. Nothing bounces or flashes.

## 2. Theme

**Follow the phone.** Light and dark themes switch automatically with the iPhone setting.

- Use `useColorScheme()` and a single `theme.ts` file exporting color tokens for both modes. Never hard-code colors in components.
- Set `"userInterfaceStyle": "automatic"` in `app.json`.
- Test every screen in both modes before finishing a phase.

## 3. Colors

**Built from the app icon.** The icon has three roles: a ground (cream or mocha), a figure (the green or cream "t") and a spark (the terracotta dot). The app uses them the same way:

- **Ground:** whitish cream `#FBF6EC` in light mode (a softer, less yellow version of the icon's cream), mocha `#403233` in dark mode.
- **Figure:** the headword and main actions. Forest green `#345830` in light mode, cream in dark mode (exactly like the dark icon).
- **Spark:** terracotta, used sparingly: the dot after the headword, the saved heart, the streak flame. A deeper terracotta marks Premium.
- **Ink swap:** mocha is the body text in light mode and cream is the body text in dark mode, so the two modes mirror each other (about 11:1 both ways).

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FBF6EC` | `#403233` | Screen background |
| `surface` | `#F2E8D6` | `#352829` | Translation block, sheets, list rows (a slightly deeper inset in both modes) |
| `text` | `#403233` | `#FFF2D5` | Body text: definitions, examples, translations |
| `textSecondary` | `#766058` | `#CDB9A6` | Part of speech, labels, hints, inactive icons |
| `border` | `#E2D4BA` | `#56464A` | Hairlines and outlines |
| `word` | `#345830` | `#FFF2D5` | The headword only |
| `spark` | `#B5663F` | `#C57B57` | Headword dot, filled heart, streak flame. Never for text |
| `accent` | `#345830` | `#FFF2D5` | Buttons, active tab, example bar, selected chips. Button text uses `background` |
| `accentSoft` | `#E3E3D5` | `#5B4D4A` | Selected chip fill, Leitner bar start |
| `premium` | `#9B4F34` | `#EFA27C` | Premium badge, lock icon, paywall button, Premium-only features |
| `premiumSoft` | `#F1E5DA` | `#553F3C` | Premium badge background, selected paywall plan |
| `correct` | `#345830` | `#B3D1A4` | AI Coach "correct" (always with a checkmark icon) |
| `partly` | `#8A5A0F` | `#EDBE6A` | AI Coach "partly" |
| `wrong` | `#A93D2C` | `#F5A08F` | AI Coach "incorrect", destructive actions |

- All text colors pass WCAG AA (4.5:1) on both `background` and `surface`; `spark` passes 3:1 for icons.
- Dark mode has no green except the "correct" verdict, like the dark icon. Its buttons are cream with mocha text.
- Premium uses `premium`, never `accent`.

## 4. Typography

- **Fraunces** (via `@expo-google-fonts/fraunces` + `expo-font`, both work in Expo Go):
  - **Headword:** Fraunces Bold (700), about 44 pt, in `word`, followed by a terracotta `spark` dot (a nested `<Text>` period, so it scales with the word). One step lighter than the icon's ExtraBold, which gets too dense for long words.
  - **Screen titles:** Fraunces SemiBold (600), about 28 pt.
  - **Example sentences and part of speech:** Fraunces Italic (400). Only one italic face in the app; the part of speech no longer uses the system italic.
- **iOS system font** (SF Pro) for everything else: definitions (17 pt), labels, buttons, lists, settings.
- Small labels such as level and category: system font, 12 pt, uppercase, letter spacing 1, `textSecondary`.
- Line height about 1.4 for body text. Never go below 13 pt.

## 5. Word card (the feed)

Full screen, one card per swipe, content vertically centered with generous side padding (24 pt).

```
  C1 · ACADEMIC                    (small caps label, 10 pt above the word)

  untenable.  🔊                   (Fraunces Bold, green/cream; terracotta dot)
  adjective                        (Fraunces Italic, secondary)

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

- The translation is **always blurred** (`expo-blur`, which works in Expo Go) with a small "Tap to reveal" hint, on word cards and review cards, so the learner tries to recall the meaning first. Tapping un-blurs it.
- Seen word IDs are still stored locally (AsyncStorage) for History (SPEC 4.13) and the level-up card. A word counts as seen once its card has been on screen.

Actions:

- **Speaker** (Ionicons `volume-medium-outline`, `textSecondary`) next to the word: reads it aloud with `expo-speech`. Icon turns `accent` while speaking.
- **Heart** saves to Favorites. Filled `spark` (terracotta) when saved. Light haptic tap on save (`expo-haptics`, works in Expo Go).
- **Plus** opens a native-style bottom sheet listing sets, with "+ New set" at the top.

## 6. Other card types

- **Review card:** same layout, with a small `accent` "REVIEW" label at the top and a thin `accent` outline. Prompt in Fraunces: "What does *untenable* mean? Use it in a sentence." Below it, a text box and a round microphone button. AI feedback appears in a surface block colored by verdict (`correct` / `partly` / `wrong`).
- **Locked teaser card (free users):** the word card blurred behind `expo-blur`, with a centered `premium` lock icon, a "PREMIUM" badge, and one line such as "Unlock C1 and C2 words". Tapping opens the paywall.

## 7. Other screens

- **Tab bar:** Feed, Sets, Progress, Settings. Icons from `@expo/vector-icons` (Ionicons): `book-outline`, `albums-outline`, `stats-chart-outline`, `settings-outline`. Active tint `accent`.
- **Feed header:** small and quiet. Current streak at the top right as a flame icon plus number in `spark` (e.g. `🔥 4`, using Ionicons `flame`).
- **Progress:** large Fraunces numbers with small uppercase labels (Words learned, Saved, Seen, Reviews today, Streak / Best). One horizontal bar split into Leitner boxes 1 to 4, shaded from `accentSoft` to `accent`. No busy charts.
- **Onboarding:** one question per screen, large Fraunces question, options as large rounded chips (selected: `accentSoft` background, `accent` border). A single `accent` "Continue" button at the bottom.
- **Sets:** a native grouped list. Each row shows the set name and word count. Favorites is pinned at the top with a heart icon.
- **Settings:** native grouped list (like iOS Settings). A Premium status row with a `premium` badge, "Restore purchases" and "Upgrade to Premium" rows, and a "Daily reminder" row with a switch and time picker.
- **Paywall:** built in the RevenueCat dashboard. Match the colors above (`premium` button, cream background) and use the same calm tone.

## 8. Shapes, spacing, motion

- Corner radius: 16 for cards and blocks, 12 for chips and buttons.
- Spacing scale: 4, 8, 12, 16, 24, 32.
- No heavy shadows. Use `surface` plus a hairline `border` instead.
- Motion: short fades (150 to 250 ms) for reveal and blur changes. The feed snaps one card per swipe.

## 9. App icon and name

**Name:** Termin. **Icon (final, chosen by the owner):** a lowercase Fraunces ExtraBold "t" with a terracotta (`#C57B57`) dot after it, like "t." Two versions:

- **Light (main icon):** forest green `#345830` "t" on cream `#FFF2D5`.
- **Dark:** cream `#FFF2D5` "t" on mocha `#403233`. Used as the iOS dark app icon and on the dark splash screen.

| File | Use |
|---|---|
| `assets/images/icon.png` / `icon-dark.png` | 1024×1024 app icons, full bleed (iOS rounds them). app.json sets both under `ios.icon` |
| `assets/images/logo.png` / `logo-dark.png` | 512×512 rounded icons for use inside the app. Pick by color scheme |
| `assets/images/splash-icon.png` / `splash-icon-dark.png` | Splash screen images (light and dark) |
| `assets/images/android-icon-*.png` | Android adaptive icon (green "t." foreground, cream background, monochrome) |
| `assets/images/favicon.png` | 48×48 web favicon |
| `assets/brand/logo.svg` / `logo-dark.svg` | Vector sources |
| `assets/brand/wordmark-light.png` / `-dark.png` | Icon plus "Termin" wordmark for the README, Devpost and the demo video |
