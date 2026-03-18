export interface StructuredBrandProfile {
  identity: {
    oneLiner: string;
    offerings: string;
    differentiators: string;
  };
  mandatoryElements: {
    brandNameDisplay: string;
    tagline: string;
    defaultCta: string;
    contactInfo: string;
    legalText: string;
    otherMandatory: string;
  };
  voiceMessaging: {
    voiceTraits: string;
    messagingPillars: string;
    wordsToUse: string;
    wordsToAvoid: string;
  };
  targetAudience: {
    primary: string;
    secondary: string;
    emotionalResponse: string;
  };
  visualStyle: {
    mood: string;
    lighting: string;
    photography: string;
    layout: string;
    textures: string;
    compositionRules: string;
  };
  dosAndDonts: {
    visualDos: string;
    visualDonts: string;
    contentDos: string;
    contentDonts: string;
  };
  colorNotes: string;
  assetRules: string;
}

export const EMPTY_PROFILE: StructuredBrandProfile = {
  identity: { oneLiner: "", offerings: "", differentiators: "" },
  mandatoryElements: { brandNameDisplay: "", tagline: "", defaultCta: "", contactInfo: "", legalText: "", otherMandatory: "" },
  voiceMessaging: { voiceTraits: "", messagingPillars: "", wordsToUse: "", wordsToAvoid: "" },
  targetAudience: { primary: "", secondary: "", emotionalResponse: "" },
  visualStyle: { mood: "", lighting: "", photography: "", layout: "", textures: "", compositionRules: "" },
  dosAndDonts: { visualDos: "", visualDonts: "", contentDos: "", contentDonts: "" },
  colorNotes: "",
  assetRules: "",
};

interface SerializedResult {
  brand_brief: string;
  brand_voice_rules: string;
  negative_prompts: string;
}

export function serialize(profile: StructuredBrandProfile): SerializedResult {
  const lines: string[] = [];

  // Identity
  if (profile.identity.oneLiner || profile.identity.offerings || profile.identity.differentiators) {
    lines.push("## BRAND IDENTITY");
    if (profile.identity.oneLiner) lines.push(`One-Liner: ${profile.identity.oneLiner}`);
    if (profile.identity.offerings) lines.push(`Offerings:\n${profile.identity.offerings}`);
    if (profile.identity.differentiators) lines.push(`Differentiators:\n${profile.identity.differentiators}`);
    lines.push("");
  }

  // Mandatory Elements
  const me = profile.mandatoryElements;
  if (me.brandNameDisplay || me.tagline || me.defaultCta || me.contactInfo || me.legalText || me.otherMandatory) {
    lines.push("## MANDATORY ELEMENTS");
    if (me.brandNameDisplay) lines.push(`Brand Name (as displayed): ${me.brandNameDisplay}`);
    if (me.tagline) lines.push(`Tagline: ${me.tagline}`);
    if (me.defaultCta) lines.push(`Default CTA: ${me.defaultCta}`);
    if (me.contactInfo) lines.push(`Contact: ${me.contactInfo}`);
    if (me.legalText) lines.push(`Legal/Compliance: ${me.legalText}`);
    if (me.otherMandatory) lines.push(`Other: ${me.otherMandatory}`);
    lines.push("");
  }

  // Voice & Messaging
  const vm = profile.voiceMessaging;
  if (vm.messagingPillars || vm.wordsToUse || vm.wordsToAvoid) {
    lines.push("## MESSAGING & VOCABULARY");
    if (vm.messagingPillars) lines.push(`Messaging Pillars:\n${vm.messagingPillars}`);
    if (vm.wordsToUse) lines.push(`Words/Phrases TO USE: ${vm.wordsToUse}`);
    if (vm.wordsToAvoid) lines.push(`Words/Phrases TO AVOID: ${vm.wordsToAvoid}`);
    lines.push("");
  }

  // Visual Style
  const vs = profile.visualStyle;
  if (vs.mood || vs.lighting || vs.photography || vs.layout || vs.textures || vs.compositionRules) {
    lines.push("## VISUAL DNA");
    if (vs.mood) lines.push(`Mood: ${vs.mood}`);
    if (vs.lighting) lines.push(`Lighting: ${vs.lighting}`);
    if (vs.photography) lines.push(`Photography: ${vs.photography}`);
    if (vs.layout) lines.push(`Layout: ${vs.layout}`);
    if (vs.textures) lines.push(`Textures: ${vs.textures}`);
    if (vs.compositionRules) lines.push(`Composition Rules:\n${vs.compositionRules}`);
    lines.push("");
  }

  // Do's
  const dd = profile.dosAndDonts;
  if (dd.visualDos || dd.contentDos) {
    lines.push("## DO'S");
    if (dd.visualDos) lines.push(`Visual Do's:\n${dd.visualDos}`);
    if (dd.contentDos) lines.push(`Content Do's:\n${dd.contentDos}`);
    lines.push("");
  }

  // Color notes & asset rules
  if (profile.colorNotes) {
    lines.push("## COLOUR PALETTE NOTES");
    lines.push(profile.colorNotes);
    lines.push("");
  }
  if (profile.assetRules) {
    lines.push("## ASSET USAGE RULES");
    lines.push(profile.assetRules);
    lines.push("");
  }

  const rendered = lines.join("\n").trim();

  // Voice rules from voice traits + audience
  const voiceParts: string[] = [];
  if (vm.voiceTraits) voiceParts.push(`Voice Traits: ${vm.voiceTraits}`);
  const ta = profile.targetAudience;
  if (ta.primary) voiceParts.push(`Primary Audience: ${ta.primary}`);
  if (ta.secondary) voiceParts.push(`Secondary Audience: ${ta.secondary}`);
  if (ta.emotionalResponse) voiceParts.push(`Desired Emotional Response: ${ta.emotionalResponse}`);

  // Negative prompts from don'ts
  const negParts: string[] = [];
  if (dd.visualDonts) {
    negParts.push("## VISUAL NEVERS");
    negParts.push(dd.visualDonts);
  }
  if (dd.contentDonts) {
    negParts.push("## CONTENT NEVERS");
    negParts.push(dd.contentDonts);
  }

  const envelope = JSON.stringify({ _structured: true, sections: profile, _rendered: rendered });

  return {
    brand_brief: envelope,
    brand_voice_rules: voiceParts.join("\n"),
    negative_prompts: negParts.join("\n"),
  };
}

export function parse(brandBrief: string): { structured: boolean; profile: StructuredBrandProfile } {
  if (!brandBrief) return { structured: false, profile: { ...EMPTY_PROFILE } };

  try {
    const parsed = JSON.parse(brandBrief);
    if (parsed?._structured && parsed?.sections) {
      return { structured: true, profile: { ...EMPTY_PROFILE, ...parsed.sections } };
    }
  } catch {
    // Not JSON — legacy free-text
  }

  return { structured: false, profile: { ...EMPTY_PROFILE } };
}

/** Extract the rendered markdown from a brand_brief (works for both structured and legacy) */
export function getRenderedBrief(brandBrief: string): string {
  if (!brandBrief) return "";
  try {
    const parsed = JSON.parse(brandBrief);
    if (parsed?._structured && parsed?._rendered) {
      return parsed._rendered;
    }
  } catch {
    // legacy
  }
  return brandBrief;
}
