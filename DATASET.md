# Termin: Word Dataset Plan

> Written on Sep 28, when the app was still called Wordloop and Premium was called Pro. Kept as written; current totals are in the README (2,747 words).

Sep 28, 2026 · @Kian

Approved plan for Phase 3 (the word dataset). Read together with SPEC.md; where they differ, this file wins until SPEC.md is updated.

Wordloop will produce about 2,400 checked word cards (475 per language) for under $10, with a two-model pipeline where each count is a maximum, never a quota. Debate becomes part of Academic, and two broader categories replace it.

## Categories

Replace Debate with **Everyday** and **Work**, and fold the best debate words into **Academic**. Debate is too narrow to sell to most learners, and its strongest words (concede, rebut, undermine) are really essay and argument words. Anyone who still wants a Debate list can build one as a set.

| Category | What it covers | English example | Who it serves |
| --- | --- | --- | --- |
| Academic | Essays, analysis, argument, opinion, linking words | undermine, whereas, substantiate | Students, exam takers (IB, IELTS, DELF, Goethe) |
| Everyday | Natural conversation, collocations, phrasal verbs, register | put up with, awkward, to be fed up | Anyone who wants to sound natural |
| Work | Meetings, emails, negotiation, workplace | follow up, leverage, deadline | Adults and professionals, the most likely payers |
| Idioms | Fixed expressions with a non-literal meaning | a blessing in disguise | Advanced learners (Pro) |

Alternatives considered and left out: **Exam prep** overlaps Academic. **News and society** is a topic list, which suits a later update. **Phrasal verbs** only exists in English. **Collocations** are a type of word, not a topic, so they appear inside Everyday and Work instead.

## Word counts

Each language gets up to 475 words, 2,375 in total. Most go to B2 and C1, the core of an app for advanced learners. Each number is a **cap**: the generator returns fewer rather than invent filler, and the checker drops weak entries, so real counts will land somewhat lower. The caps are the same for all five languages.

| Category | B1 | B2 | C1 | C2 | Total |
| --- | --- | --- | --- | --- | --- |
| Academic | 25 | 40 | 40 | 30 | 135 |
| Everyday | 30 | 40 | 35 | 25 | 130 |
| Work | 20 | 30 | 30 | 20 | 100 |
| Idioms | 15 | 30 | 35 | 30 | 110 |
| **Total** | **90** | **140** | **140** | **105** | **475** |

- **B1 is small** because few idioms and work terms are truly B1, and those learners are below the app's main audience.
- **C2 is smaller than C1** because genuinely C2 words that are still useful run out quickly.
- **Free vs Pro:** free covers B1 and B2 in Academic, Everyday and Work (185 words per language). Pro adds C1, C2 and Idioms at every level (290 more). The gating rule stays "Pro unlocks C1, C2 and Idioms", so the code change is only the category names.
- A free B2 learner with all three free categories has 110 words at their level, roughly two weeks of new words at 8 a day, before blending adds more.

## Blending advanced words into the feed

Yes: learners who do well get "stretch" cards from one level up, and it all runs on the phone from data the app already keeps. The Leitner boxes and review answers show how well someone is doing, so no server or account is needed.

| Learner state | Rule (from local data) | Feed behaviour |
| --- | --- | --- |
| Normal | Default | Only words at the chosen level |
| Ready | 80% or more of the last 20 reviews correct, and 15 or more words in box 3 or higher | 1 stretch card in every 8 |
| Strong | 90% or more of the last 20 reviews correct | 1 stretch card in every 5 |
| Running out | 80% of the level's words already seen | A one-time card: "You're ready for C1. Switch level?" |
| Struggling | Under 60% of the last 20 reviews correct | Stretch cards stop until accuracy recovers |

- Stretch cards carry a small **Stretch · C1** badge and come only from the categories the user picked. Saving and reviewing work as normal.
- **The paywall link:** for a free B2 learner, the level above is C1, which is Pro. Their stretch cards appear as locked teasers saying "You're ready for C1", and tapping one opens the paywall. The upsell is earned by progress instead of shown at random, which makes a stronger demo moment and a more thoughtful use of RevenueCat. Show at most one locked stretch card per 15 cards so it never feels pushy.
- A free B1 learner's stretch cards come from B2, which is free, so they are normal cards.
- **Build:** one small function in the feed builder plus a new SPEC section 4.12. It belongs in Phase 4, after Pro gating exists. A development-only Settings row, "Simulate strong learner", makes it testable and easy to film.

## Production pipeline

1. **Pick candidate words** (Model A): words only, 1.5x the cap per combination.
2. **Filter and remove repeats** (Model B ranks level fit; a script removes repeats; keep the cap).
3. **Write full entries** (Model A): batches of 10, strict JSON, 4 translations.
4. **Automatic checks** (script): fields, IDs, word in example, Wiktionary match.
5. **Model review** (Model B): flags only, each with a reason and severity.
6. **Serious flag?** Yes: regenerate once with the reason (Model A), recheck from step 4; still flagged after that: dropped. No: continue.
7. **Owner review** (Kian): remaining minor flags and a random sample.
8. **Ship**: one JSON file per language, bundled in the app.

Candidates are picked as bare words, which costs almost nothing, so only the best-fitting words get full entries. A serious flag gets one automatic retry, and anything still failing is dropped rather than fixed by hand. That keeps your review to the minor flags and a sample.

## Models and cost

The whole run should cost about $2 to $6, under a hard $10 cap. It uses about 1.2M output tokens: the full entries are most of it, and picking words is almost free.

| Stage | Model | Approx. output tokens |
| --- | --- | --- |
| 1–2. Pick and filter words | A, then B | 0.1M |
| 3. Write entries | A | 0.85M |
| 5. Model review | B | 0.2M |
| Retries (about 15%) | A and B | 0.15M |

- **Model A (generator)** does the writing, so quality matters most here. Aim for a mid-priced model with strong French, German, Spanish and Portuguese, costing no more than about $3 per million output tokens.
- **Model B (checker)** must come from a **different company** than A, so the two don't share the same blind spots. A budget model is enough, because it only flags problems.
- **Choose by test, not by name.** Candidates listed on OpenRouter this month include budget models such as GLM 5.3 Flash and DeepSeek V4.1 Flash, and mid-priced ones such as MiMo-V2.6-Pro ([price comparison](https://costgoat.com/compare/llm-api)). The test batch runs two generator candidates on the same words, and the better one wins. Check each chosen model's terms for commercial use.
- **Spending limits:** give the OpenRouter key a $10 limit, and have the script track spend and stop at $8. Buying $10 of credit also raises free-model limits from 50 to 1,000 requests a day ([OpenRouter](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know)), so free models can join the test too.
- **Resumable:** the script saves each finished combination to disk. A crash or rate limit costs nothing already paid for.

## Quality gates

Quality comes from four layers: strict writing rules, free script checks, a second model, and your own review of what remains. Each layer catches what the one before misses.

**Writing rules (in Model A's prompt)**

- Words must be common and useful at their CEFR level. No rare, archaic or overly technical words.
- Definitions and examples are original. Never quote dictionaries, books, films or famous lines.
- Definitions use simpler words than the headword, under 20 words. Examples are 8 to 20 words and show the meaning through context.
- Portuguese is European Portuguese and Spanish is Spain Spanish, to match the pt-PT and es-ES voices. French is France French.
- Nouns in German, French, Spanish and Portuguese include their article (die Nachhaltigkeit, le défi), because learners need the gender.
- Idiom translations use the equivalent idiom if one exists, and a short plain explanation if not. Never a word-for-word translation.

**Script checks (free, every entry)**

- Every field is present and no string is empty. IDs are unique, and no word repeats within a language.
- The headword, or a form of it, appears in the example. A miss is flagged, not dropped, because verbs change form.
- The definition is compared with Wiktionary's definitions for the same word. A very close match is treated as a serious flag and regenerated.

**Model B review (every entry)**

| Severity | What counts | What happens |
| --- | --- | --- |
| Serious | Wrong meaning, wrong translation, wrong language variant, wrong category, sounds copied | One automatic retry, then dropped |
| Minor | Level slightly off, awkward phrasing, weak example | Goes to your review |

**Your review (about 2 hours)**

- **English and German:** every minor flag, plus 10 random entries per level (40 per language).
- **French, Spanish, Portuguese:** minor flags about meaning or translation are dropped, and minor flags about level are kept. If a friend speaks one of them, ask them to look over 20 entries.
- **Stop rule:** if more than 4 of your 40 random entries in a language have real errors, fix the prompt and regenerate that language before going further.

## Next steps

Your part takes about 15 minutes before Claude Code can start, plus about 3 hours of review spread over the test and the full run. If review runs late before the deadline, ship the entries that already passed: the counts are caps, so a smaller dataset is still a finished one.

**You, first**

- [x] Approve this plan, especially Everyday and Work replacing Debate
- [x] Create an OpenRouter account, buy $10 of credit, and create an API key with a $10 limit
- [x] Paste the key into `.env` as `OPENROUTER_API_KEY=...` yourself, never into chat or git
- [x] Tell Claude Code to start Phase 3 with this plan

**Claude Code, Phase 3**

- [x] Update SPEC.md: categories, caps and writing rules in section 3, category names in section 5, and a new section 4.12 for blending
- [x] Rename the category IDs in the app and onboarding (debate becomes everyday, plus work)
- [x] Write the scripts: pick words, write entries, script checks, model review, retry, and validation, with saved progress and the $8 stop
- [x] Test batch: 10 words each of C1 Academic and B1 Idioms in all five languages (100 entries), run with two generator candidates. B1 Idioms is included because it is the thinnest combination
- [x] You review the English and German test entries; then pick models A and B and adjust the prompts
- [x] Full run, script checks, model review and retries
- [ ] Your review (about 2 hours), using the quality gates above
- [ ] Load the data into the app, test the feed on your iPhone, commit and push

**Later, Phase 4**

- [ ] Build blending and the locked "You're ready for C1" stretch cards together with Pro gating

## Results (Sep 28)

- **Models:** GPT-6 Luna Pro (`openai/gpt-6-luna-pro`) writes; Gemini 3.8 Flash (`google/gemini-3.8-flash`) checks. Mistral Large was rate-limited upstream, MiMo made more grammar and variant errors in the test, and GLM 5.3 Flash was too slow and gave false flags as a checker.
- **Words shipped:** 2,056 (en 443, de 427, es 417, fr 406, pt 363), with 15 dropped by the pipeline and 118 minor flags left for review.
- **Cost:** $7.08 in total, including all tests. The stop was raised from $8 to $9.50 during the run because the Gemini reviews cost more than estimated.

## Owner review and additions (Sep 28–29)

- **Review:** every flag in all five languages was checked by hand. 67 entries were fixed (`data/review/fixes.json`), 36 were moved to the correct level, and 9 were dropped as duplicates or A1/A2 basics (`data/review/drops.txt`).
- **Hand-written words:** 300 more entries in `data/manual/`, written without OpenRouter: 200 spread across the thinnest combinations (mostly idioms), plus 100 advanced English words (C1/C2 Academic, Work and Everyday). They pass the same script checks, and their IDs end in `-m01`, `-m02`, etc. The 100 English words go above the original caps.
- **Totals:** en 560, fr 450, de 449, es 453, pt 435 (2,347 words).

## Sources

- [OpenRouter rate limits](https://openrouter.zendesk.com/hc/en-us/articles/39501163636379-OpenRouter-Rate-Limits-What-You-Need-to-Know): 50 free-model requests a day without a purchase, 1,000 after buying $10 of credit.
- [CostGoat LLM API price comparison](https://costgoat.com/compare/llm-api): current prices for budget and mid-priced models, September 2026.
- [Kaikki.org](https://kaikki.org/dictionary/): Wiktionary as machine-readable data, used for the originality check (CC BY-SA).
