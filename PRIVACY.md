# Termin: Privacy

Last updated: September 30, 2026

Termin is a vocabulary app built for the RevenueCat Shipaton 2026. It has no accounts and collects as little as possible.

## What stays on your phone

Your settings, saved words and sets, review progress, streak, history and reminder times are stored only on your device (AsyncStorage). They are never uploaded, except for the AI feature data described below. Deleting the app deletes them.

## What leaves your phone

- **AI Coach (Check button):** your typed answer, the word, its definition and your languages are sent to Termin's server (a Cloudflare Worker), which asks an AI model through OpenRouter to grade it. Answers are not logged or stored. The server keeps only a daily count of checks per random device ID, which expires after 48 hours.
- **Voice answers (microphone):** the recording is sent to the same server and transcribed by Cloudflare Workers AI (Whisper). The audio is not stored, on the server or on your phone.
- **Say it better (Premium):** when you tap Say it better, your sentence and a list of words it may use (including your saved words in that language) are sent to the same server and AI model to rewrite it. They are not logged or stored; the server keeps only a daily count per random device ID, which expires after 48 hours.
- **Explain it differently:** the card's word, definition and example are sent to the same server and AI model. Nothing about you is sent besides the random device ID for the daily count.
- **Words from a text:** the text you paste, the web address you paste (the server downloads that page), or the photos of pages you take or choose are sent to the same server and AI model to find words worth learning. They are not logged or stored; the server keeps only a daily count per random device ID.
- **Snap a word:** the photo you take or choose is shrunk on your phone and sent to the same server and AI model, together with your languages and level, to write a word card. The photo is not logged or stored, on the server or by Termin on your phone. The server keeps a count of photos per random device ID (for free users, 2 in total, without expiry). Cards you save stay only on your phone.
- **AI reminders (Premium, off by default):** while switched on, up to 8 of your saved words are sent to the same server and AI model when you open the app (at most every 2 hours), together with how well you know each one (its review stage, when it is due, and how often you got it wrong), your reminder times and your phone's local time. The AI uses them to pick and word your reminders. They are not logged or stored; the server keeps only a daily count of these requests per random device ID, which expires after 48 hours. Switch AI reminders off in Settings → Reminders to stop this.
- **Purchases:** subscriptions are handled by RevenueCat, which uses an anonymous app user ID. Termin never sees payment details.
- **Reminders** are local notifications scheduled on your phone. No push server is involved.

The device ID is a random number created on your phone. It is not linked to your name, email or Apple ID.

## Contact

Questions: open an issue at https://github.com/kian1s/wordloop.
