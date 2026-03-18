export interface StructuredBrandProfile {
  brandIdentity: string;
  mustInclude: string;
  visualDirection: string;
  voiceAndTone: string;
  dos: string;
  donts: string;
  colorNotes: string;
  referenceNotes: string;
}

export const EMPTY_PROFILE: StructuredBrandProfile = {
  brandIdentity: "",
  mustInclude: "",
  visualDirection: "",
  voiceAndTone: "",
  dos: "",
  donts: "",
  colorNotes: "",
  referenceNotes: "",
};

interface SerializedResult {
  brand_brief: string;
  brand_voice_rules: string;
  negative_prompts: string;
}

export function serialize(profile: StructuredBrandProfile): SerializedResult {
  const lines: string[] = [];

  if (profile.brandIdentity) {
    lines.push("## BRAND IDENTITY");
    lines.push(profile.brandIdentity);
    lines.push("");
  }

  if (profile.mustInclude) {
    lines.push("## MANDATORY ELEMENTS");
    lines.push(profile.mustInclude);
    lines.push("");
  }

  if (profile.visualDirection) {
    lines.push("## VISUAL DIRECTION");
    lines.push(profile.visualDirection);
    lines.push("");
  }

  if (profile.dos) {
    lines.push("## DO'S — ALWAYS");
    lines.push(profile.dos);
    lines.push("");
  }

  if (profile.colorNotes) {
    lines.push("## COLOUR PALETTE NOTES");
    lines.push(profile.colorNotes);
    lines.push("");
  }

  if (profile.referenceNotes) {
    lines.push("## ADDITIONAL NOTES");
    lines.push(profile.referenceNotes);
    lines.push("");
  }

  const rendered = lines.join("\n").trim();

  const envelope = JSON.stringify({ _structured: true, sections: profile, _rendered: rendered });

  return {
    brand_brief: envelope,
    brand_voice_rules: profile.voiceAndTone,
    negative_prompts: profile.donts,
  };
}

export function parse(brandBrief: string): { structured: boolean; profile: StructuredBrandProfile } {
  if (!brandBrief) return { structured: false, profile: { ...EMPTY_PROFILE } };

  try {
    const parsed = JSON.parse(brandBrief);
    if (parsed?._structured && parsed?.sections) {
      // Handle migration from old format
      const sections = parsed.sections;
      if (sections.brandIdentity !== undefined) {
        // New format
        return { structured: true, profile: { ...EMPTY_PROFILE, ...sections } };
      }
      // Old format — migrate
      const migrated: StructuredBrandProfile = {
        brandIdentity: [
          sections.identity?.oneLiner,
          sections.identity?.offerings,
          sections.identity?.differentiators,
        ].filter(Boolean).join("\n"),
        mustInclude: [
          sections.mandatoryElements?.brandNameDisplay && `Brand Name: ${sections.mandatoryElements.brandNameDisplay}`,
          sections.mandatoryElements?.tagline && `Tagline: ${sections.mandatoryElements.tagline}`,
          sections.mandatoryElements?.defaultCta && `CTA: ${sections.mandatoryElements.defaultCta}`,
          sections.mandatoryElements?.contactInfo && `Contact: ${sections.mandatoryElements.contactInfo}`,
          sections.mandatoryElements?.legalText && `Legal: ${sections.mandatoryElements.legalText}`,
          sections.mandatoryElements?.otherMandatory,
        ].filter(Boolean).join("\n"),
        visualDirection: [
          sections.visualStyle?.mood && `Mood: ${sections.visualStyle.mood}`,
          sections.visualStyle?.lighting && `Lighting: ${sections.visualStyle.lighting}`,
          sections.visualStyle?.photography && `Photography: ${sections.visualStyle.photography}`,
          sections.visualStyle?.layout && `Layout: ${sections.visualStyle.layout}`,
          sections.visualStyle?.textures && `Textures: ${sections.visualStyle.textures}`,
          sections.visualStyle?.compositionRules,
        ].filter(Boolean).join("\n"),
        voiceAndTone: [
          sections.voiceMessaging?.voiceTraits && `Voice: ${sections.voiceMessaging.voiceTraits}`,
          sections.voiceMessaging?.messagingPillars,
          sections.voiceMessaging?.wordsToUse && `Use: ${sections.voiceMessaging.wordsToUse}`,
          sections.voiceMessaging?.wordsToAvoid && `Avoid: ${sections.voiceMessaging.wordsToAvoid}`,
          sections.targetAudience?.primary && `Primary Audience: ${sections.targetAudience.primary}`,
          sections.targetAudience?.secondary && `Secondary Audience: ${sections.targetAudience.secondary}`,
          sections.targetAudience?.emotionalResponse && `Desired Response: ${sections.targetAudience.emotionalResponse}`,
        ].filter(Boolean).join("\n"),
        dos: [sections.dosAndDonts?.visualDos, sections.dosAndDonts?.contentDos].filter(Boolean).join("\n"),
        donts: [sections.dosAndDonts?.visualDonts, sections.dosAndDonts?.contentDonts].filter(Boolean).join("\n"),
        colorNotes: sections.colorNotes || "",
        referenceNotes: sections.assetRules || "",
      };
      return { structured: true, profile: migrated };
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
