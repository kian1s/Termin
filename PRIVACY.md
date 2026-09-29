# Termin: Privacy

Last updated: September 29, 2026

Termin is a vocabulary app built for the RevenueCat Shipaton 2026. It has no accounts and collects as little as possible.

## What stays on your phone

Your settings, saved words and sets, review progress, streak, history and reminder times are stored only on your device (AsyncStorage). They are never uploaded. Deleting the app deletes them.

## What leaves your phone

- **AI Coach (Check button):** your typed answer, the word, its definition and your languages are sent to Termin's server (a Cloudflare Worker), which asks an AI model through OpenRouter to grade it. Answers are not logged or stored. The server keeps only a daily count of checks per random device ID, which expires after 48 hours.
- **Voice answers (microphone):** the recording is sent to the same server and transcribed by Cloudflare Workers AI (Whisper). The audio is not stored, on the server or on your phone.
- **Purchases:** subscriptions are handled by RevenueCat, which uses an anonymous app user ID. Termin never sees payment details.
- **Reminders** are local notifications scheduled on your phone. No push server is involved.

The device ID is a random number created on your phone. It is not linked to your name, email or Apple ID.

## Contact

Questions: open an issue at https://github.com/kian1s/wordloop.
