// Brand health scoring + mood derivation — shared between BrandForm header,
// BrandHub cards, and (eventually) the Studio pre-flight check.
//
// Mood derivation is a faithful client-side port of `deriveBrandMoods` in
// supabase/functions/generate-creative/index.ts so users see EXACTLY which
// moods their brief unlocks downstream.

export interface BrandHealthInput {
  hasLogo: boolean;
  taggedAssetCount: number;
  briefIdentity: string;
  briefVisual: string;
  voiceRules: string;
  visualNevers: string;
  contentNevers: string;
  industry: string | null;
}

export interface BrandHealthScore {
  score: number; // 0-100
  level: "sparse" | "partial" | "filled";
  label: string;
  color: "destructive" | "warning" | "success";
  breakdown: { signal: string; points: number; max: number; ok: boolean }[];
}

/**
 * 0-100 brand setup score. Six weighted signals.
 * Soft-blocks Studio at <30; chips: red <40, amber <70, green ≥70.
 */
export function scoreBrandHealth(input: BrandHealthInput): BrandHealthScore {
  const signals = [
    { signal: "Logo uploaded", points: input.hasLogo ? 15 : 0, max: 15, ok: input.hasLogo },
    {
      signal: "≥3 tagged assets",
      points: input.taggedAssetCount >= 3 ? 20 : input.taggedAssetCount >= 1 ? 10 : 0,
      max: 20,
      ok: input.taggedAssetCount >= 3,
    },
    {
      signal: "Brand identity ≥300 chars",
      points: input.briefIdentity.length >= 300 ? 15 : input.briefIdentity.length >= 100 ? 8 : 0,
      max: 15,
      ok: input.briefIdentity.length >= 300,
    },
    {
      signal: "Visual direction ≥400 chars",
      points: input.briefVisual.length >= 400 ? 20 : input.briefVisual.length >= 150 ? 10 : 0,
      max: 20,
      ok: input.briefVisual.length >= 400,
    },
    {
      signal: "Voice rules ≥150 chars",
      points: input.voiceRules.length >= 150 ? 15 : input.voiceRules.length >= 50 ? 8 : 0,
      max: 15,
      ok: input.voiceRules.length >= 150,
    },
    {
      signal: "Nevers populated",
      points:
        (input.visualNevers.trim().length > 0 ? 5 : 0) +
        (input.contentNevers.trim().length > 0 ? 5 : 0),
      max: 10,
      ok: input.visualNevers.trim().length > 0 && input.contentNevers.trim().length > 0,
    },
    { signal: "Industry set", points: input.industry ? 5 : 0, max: 5, ok: !!input.industry },
  ];

  const score = signals.reduce((s, x) => s + x.points, 0);
  const { level, label, color } =
    score >= 70
      ? { level: "filled" as const, label: "Filled", color: "success" as const }
      : score >= 40
        ? { level: "partial" as const, label: "Partial", color: "warning" as const }
        : { level: "sparse" as const, label: "Sparse", color: "destructive" as const };

  return { score, level, label, color, breakdown: signals };
}

// ─── Mood derivation (mirrors edge function) ────────────────────────────

export interface MoodEntry {
  label: string;
  description: string;
  traits: string[];
  forbiddenFor: string[];
}

export const CREATIVE_MOODS: MoodEntry[] = [
  {
    label: "Bold & Confident",
    description: "Bold & Confident — strong, declarative language with authority",
    traits: ["bold", "confident", "authoritative", "strong", "powerful", "assertive", "decisive"],
    forbiddenFor: ["restrained", "understated", "humble"],
  },
  {
    label: "Aspirational & Dreamy",
    description: "Aspirational & Dreamy — paint a vision of the ideal lifestyle",
    traits: ["aspirational", "dreamy", "lifestyle", "visionary", "luxury", "premium", "elevated", "refined"],
    forbiddenFor: ["practical", "utilitarian", "industrial"],
  },
  {
    label: "Minimal & Elegant",
    description: "Minimal & Elegant — fewer words, more impact, refined tone",
    traits: ["minimal", "elegant", "refined", "clean", "understated", "sophisticated", "premium", "luxury"],
    forbiddenFor: ["playful", "energetic", "loud", "maximalist"],
  },
  {
    label: "Energetic & Dynamic",
    description: "Energetic & Dynamic — action-oriented, momentum-driven language",
    traits: ["energetic", "dynamic", "youth", "young", "vibrant", "active", "fun", "playful", "bold"],
    forbiddenFor: ["restrained", "understated", "luxury", "premium", "institutional", "solemn"],
  },
  {
    label: "Warm & Inviting",
    description: "Warm & Inviting — conversational, welcoming, personal tone",
    traits: ["warm", "inviting", "friendly", "welcoming", "personal", "human", "intimate", "conversational", "family"],
    forbiddenFor: ["cold", "industrial", "corporate"],
  },
  {
    label: "Sophisticated & Premium",
    description: "Sophisticated & Premium — luxury vocabulary, understated elegance",
    traits: ["sophisticated", "premium", "luxury", "elegant", "refined", "high-end", "elevated", "exclusive"],
    forbiddenFor: ["playful", "casual", "youth", "budget", "value"],
  },
  {
    label: "Direct & Practical",
    description: "Direct & Practical — focus on tangible benefits and facts",
    traits: ["practical", "direct", "honest", "transparent", "clear", "informative", "value", "trusted"],
    forbiddenFor: ["poetic", "abstract", "dreamy"],
  },
  {
    label: "Poetic & Evocative",
    description: "Poetic & Evocative — rhythmic, image-rich, emotionally resonant",
    traits: ["poetic", "evocative", "emotional", "lyrical", "soulful", "intimate", "aspirational", "luxury"],
    forbiddenFor: ["practical", "technical", "industrial", "utilitarian"],
  },
  {
    label: "Playful & Witty",
    description: "Playful & Witty — clever wordplay, humor, lighthearted energy",
    traits: ["playful", "witty", "fun", "humorous", "casual", "youth", "quirky", "desi", "cheeky"],
    forbiddenFor: ["restrained", "institutional", "luxury", "premium", "solemn", "serious"],
  },
  {
    label: "Grounded & Authentic",
    description: "Grounded & Authentic — rooted, sincere, no-nonsense tone with cultural truth",
    traits: ["grounded", "authentic", "honest", "rooted", "cultural", "traditional", "heritage", "family", "trusted"],
    forbiddenFor: ["futuristic", "abstract", "edgy"],
  },
];

export interface DerivedMoods {
  allowed: MoodEntry[];
  reason: string;
}

export function deriveBrandMoods(
  brief: string,
  voiceRules: string,
  negativePrompts: string,
): DerivedMoods {
  const corpus = `${brief}\n${voiceRules}`.toLowerCase();
  const negativeCorpus = negativePrompts.toLowerCase();

  const toneSectionMatch = corpus.match(
    /(?:tone|voice|personality|brand voice|tone & voice|tone and voice)[\s\S]{0,1500}?(?:\n##|\n\*\*[A-Z]|$)/i,
  );
  const toneSection = toneSectionMatch ? toneSectionMatch[0] : "";

  const scored = CREATIVE_MOODS.map((mood) => {
    let score = 0;
    let disqualified = false;

    for (const forbidden of mood.forbiddenFor) {
      if (negativeCorpus.includes(forbidden)) { disqualified = true; break; }
    }
    if (disqualified) return { mood, score: -999 };

    for (const forbidden of mood.forbiddenFor) {
      const neverPattern = new RegExp(`(?:never|avoid|not|no)\\s+\\w{0,20}\\s*${forbidden}`, "i");
      if (neverPattern.test(corpus)) { disqualified = true; break; }
    }
    if (disqualified) return { mood, score: -999 };

    for (const trait of mood.traits) {
      if (corpus.includes(trait)) score += 1;
      if (toneSection && toneSection.includes(trait)) score += 1;
    }

    return { mood, score };
  });

  const eligible = scored.filter((s) => s.score > -999);
  const withSignal = eligible.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  if (withSignal.length >= 3) {
    return {
      allowed: withSignal.slice(0, Math.min(5, withSignal.length)).map((s) => s.mood),
      reason: `derived from your tone signals (${Math.min(5, withSignal.length)} moods)`,
    };
  }
  if (withSignal.length > 0) {
    const used = new Set(withSignal.map((s) => s.mood.label));
    const padding = eligible
      .filter((s) => !used.has(s.mood.label) && s.score === 0)
      .slice(0, 3 - withSignal.length)
      .map((s) => s.mood);
    return {
      allowed: [...withSignal.map((s) => s.mood), ...padding],
      reason: `partial signal — add more tone words to focus the pool`,
    };
  }
  return {
    allowed: eligible.map((s) => s.mood),
    reason: `no tone signal yet — all ${eligible.length} brand-safe moods active`,
  };
}
