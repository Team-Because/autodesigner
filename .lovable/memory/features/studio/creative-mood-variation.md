---
name: Creative Mood Variation
description: Per-generation copy mood, dynamically derived from each brand's brief/voice/negative prompts so moods always respect brand tone (e.g., premium brands never get "Playful")
type: feature
---

The Adapt step injects one "creative mood" per generation to keep copy varied across multiple runs for the same brand. The mood pool is **derived dynamically from the brand's own brief** — there is no UI control and no schema field.

## How derivation works (in `generate-creative/index.ts → deriveBrandMoods`)

1. **Corpus** = `brand_brief` + `brand_voice_rules`, lowercased. The `Tone & Voice` section gets a 2x weight boost when matched.
2. **Hard filter** — any mood whose `forbiddenFor` traits appear in `negative_prompts` is dropped (e.g., negative prompts containing "playful" disqualify the Playful & Witty mood).
3. **Soft filter** — `(never|avoid|not|no) <forbidden>` patterns in the brief also drop the mood.
4. **Score** — each mood's `traits` are searched in the corpus; matches in the Tone section count double.
5. **Selection**:
   - 3+ moods scored > 0 → take top 3-5.
   - 1-2 moods scored > 0 → use those + pad with neutral remainder to reach 3.
   - 0 signal → all eligible (forbidden-filtered) moods.
6. One mood is randomly picked from the allowed pool per generation and logged (`[Adapt] Brand "X" mood pool: ...`).

## Mood library (10 moods)
Bold & Confident, Aspirational & Dreamy, Minimal & Elegant, Energetic & Dynamic, Warm & Inviting, Sophisticated & Premium, Direct & Practical, Poetic & Evocative, Playful & Witty, Grounded & Authentic.

## Why dynamic, not stored
- Zero new UI / schema migration.
- Self-updating: editing the brand brief immediately changes the mood pool.
- Composes with existing `premium-brand-constraints` and brand-specific principles (Belrosa, Tata IIS) — luxury/restrained brands automatically lose Playful/Energetic moods because their briefs say "refined, restrained, never playful".

## Where it lives
- `supabase/functions/generate-creative/index.ts` — `CREATIVE_MOODS`, `deriveBrandMoods`, `pickMoodFromAllowed`.
- Logged per generation; visible in edge function logs for debugging.
