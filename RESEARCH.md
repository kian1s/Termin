# Termin: Competitor and Learning Research

Sep 29 to 30, 2026. Full doc with sources: https://claude.ai/code/artifact/8763ddee-0b8c-4c8d-a206-81177f89e7e7

## Where rival apps fail
- **Vocabulary (Learn words daily):** shows words, no scheduled review, review games paywalled, loud ads, same words repeat, too easy for advanced learners.
- **Anki:** review backlogs (20 new/day grows to 200+ reviews/day in ~4 weeks), guilt, card making, no context.
- **Duolingo:** engagement over learning, basic vocabulary, little speaking.
- **Quizlet:** Learn and Test modes paywalled since Aug 2022.
- **Memrise:** removed user-made courses in 2024.

## What works (research)
- Recall beats rereading: ~80% vs ~35% one-week recall (Karpicke & Roediger 2008).
- Spacing beats cramming (Cepeda et al. 2006, 317 experiments).
- Writing with the word, gap fills and inferring meaning retain well (ILH review, 78 studies).
- Learners prefer rereading lists and misjudge what works, so the app must make recall feel easy and fun.

## Plan (proposed, not yet confirmed by Kian)
- Before submission: rotate review card formats (Match it, Fill the gap, Use it); optional daily review cap of 15 and a weekly streak freeze.
- **Match it** (Kian's pick, replaces "Pick the meaning"): each round randomly shows a word with 4 definitions or a definition with 4 words, plus "I don't know"; distractors from the same level and category; 10 rounds with a streak bonus. Free, low effort (reuses level test code).
- Rule: in-feed review stays free; Premium sells words, AI checks, flashcards, AI games.
- After Shipaton: Speed round, Daily mystery word, Explain it (Taboo), Debate duel, Story chain, Formal or casual, "Too easy / Not useful" buttons, add-my-own-word.

## Skippable review cards (Kian's decision, Sep 30; not yet in SPEC.md)
- Review cards in the feed can be skipped: swipe past or tap a small Skip button.
- Settings gets an "Allow skipping review cards" toggle, **on by default**. Off = must-answer mode (feed locks until the card is answered or revealed).
- Proposed details: a skipped word keeps its box, doesn't count as a review or toward the streak, stays due, and comes back after at least 10 more cards.

## AI reminders (Kian's requirements, Sep 30; full implementation plan in the doc)
- Toggle "AI reminders" in Settings → Reminders.
- AI picks which saved words need rehearsal; each notification shows one word.
- Tapping opens a short quick test: the notified word plus other saved words (proposed: 5 questions, Match it and Fill the gap).
- **Hard rule:** the user always chooses. Opening a notification shows a start card with **Start test** and **Skip, keep scrolling**. Skip goes to the feed, records nothing as wrong, the word stays due and isn't re-sent that day. A Skip link stays on every question; leaving early keeps answers given.
- At most one notification per 2 hours (across all notification types); the same word in at most one notification per day.
- Proposed build: Expo Go has no background execution, so the plan is rebuilt on app open, after reviews and on settings change, scheduling the next 48 h locally. App code scores words (days overdue + 2 × recent errors + (4 − box)); the Worker's `POST /plan-reminders` orders the top 8 and writes the text; app code enforces all rules; offline fallback uses local order and a fixed text.
- Open: Free or Premium, daily cap, build before or after submission.
