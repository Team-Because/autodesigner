// Shared utilities for parsing the Master Prompt output and serializing
// the structured "Never List" into the existing negative_prompts text column.
//
// The negative_prompts column stays plain text (no migration needed). When we
// have structured visual/content nevers we serialize them as:
//
//     ## VISUAL NEVERS
//     - …
//     ## CONTENT NEVERS
//     - …
//
// Older rows (plain text, no headers) are read as `general` nevers — they
// still feed both the image prompt and mood derivation, exactly like today.

const INDUSTRIES = [
  "Real Estate", "Education", "Healthcare", "Retail", "Fashion",
  "Technology", "Food & Beverage", "Automotive", "Hospitality", "Finance",
] as const;

export type Industry = typeof INDUSTRIES[number];

export interface ParsedColor {
  name: string;
  hex: string;
}

export interface ParsedAssetTag {
  index: number; // 1-based asset index from the prompt
  label: string;
  tag: string;
}

export interface ParsedMasterOutput {
  industry: string | null;
  brandName: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  extraColors: ParsedColor[];
  assetTags: ParsedAssetTag[];
  briefIdentity: string;
  briefMandatory: string;
  briefVisual: string;
  briefCopy: string;
  voiceRules: string; // Combined Tone & Voice + Target Audience
  visualNevers: string;
  contentNevers: string;
}

/** Strip a single ``` fenced block wrapper if the LLM wrapped sections. */
function stripOuterFence(text: string): string {
  const trimmed = text.trim();
  // Only strip if the WHOLE block is fenced
  const m = trimmed.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  return m ? m[1] : trimmed;
}

/** Split source into ## sections keyed by their canonical lowercased title. */
function splitSections(raw: string): Record<string, string> {
  const text = stripOuterFence(raw);
  const lines = text.split("\n");
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  let currentLines: string[] = [];

  const commit = () => {
    if (currentKey !== null) {
      sections[currentKey] = currentLines.join("\n").trim();
    }
  };

  for (const line of lines) {
    const headerMatch = line.match(/^#{2,4}\s+(.+?)\s*$/);
    if (headerMatch) {
      commit();
      const title = headerMatch[1]
        .replace(/^brand brief\s*[—\-:]\s*/i, "")
        .replace(/^section\s*\d+\s*[:.\-]\s*/i, "")
        .replace(/^\d+\.\s*/, "")
        .replace(/[:．。]+$/, "")
        .replace(/[·•]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      currentKey = title;
      currentLines = [];
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
  }
  commit();
  return sections;
}

const HEX_RE = /#([0-9a-f]{6})\b/i;

function findIndustry(value: string): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  for (const ind of INDUSTRIES) {
    if (lower.includes(ind.toLowerCase())) return ind;
  }
  return null;
}

function parseColorPalette(body: string): {
  primary: string | null;
  secondary: string | null;
  extras: ParsedColor[];
} {
  const result = { primary: null as string | null, secondary: null as string | null, extras: [] as ParsedColor[] };
  if (!body) return result;
  const lines = body.split("\n");
  let inExtras = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const lower = line.toLowerCase();

    // Detect "Extra:" header → next bullets are extras
    if (/^[-*•]?\s*extra(s)?\s*[:：]/.test(lower)) {
      inExtras = true;
      continue;
    }

    const hexMatch = line.match(HEX_RE);
    if (!hexMatch) continue;
    const hex = `#${hexMatch[1].toLowerCase()}`;

    if (/primary/i.test(line) && !result.primary) {
      result.primary = hex;
      continue;
    }
    if (/secondary/i.test(line) && !result.secondary) {
      result.secondary = hex;
      continue;
    }

    // Extract a friendly name: text before ':' or before the hex
    const namePart = line
      .replace(/^[-*•\s]+/, "")
      .split(/[:：]/)[0]
      .replace(HEX_RE, "")
      .replace(/[—–\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const name = namePart && namePart.length <= 30 ? namePart : "Accent";

    if (inExtras || (result.primary && result.secondary)) {
      result.extras.push({ name, hex });
    }
  }
  return result;
}

function parseAssetTags(body: string): ParsedAssetTag[] {
  if (!body) return [];
  const tags: ParsedAssetTag[] = [];
  const lines = body.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // Patterns we accept:
    //   - Asset 1 (Logo): Logo
    //   - Asset 2: Elevation
    //   - 1. Logo
    //   - 1) Hero Image
    const m = line.match(/^[-*•]?\s*(?:asset\s*)?(\d+)\s*(?:\(([^)]*)\))?\s*[:.)]\s*(.+)$/i);
    if (!m) continue;
    const idx = parseInt(m[1], 10);
    if (!Number.isFinite(idx)) continue;
    const label = (m[2] || "").trim();
    const tag = m[3].trim().replace(/[—–\-].*$/, "").trim();
    if (!tag) continue;
    tags.push({ index: idx, label, tag });
  }
  return tags;
}

function findSection(sections: Record<string, string>, ...aliases: string[]): string {
  for (const a of aliases) {
    if (sections[a.toLowerCase()] !== undefined) return sections[a.toLowerCase()];
  }
  return "";
}

/**
 * Parse a full Master Prompt output (or a partial paste) into structured fields.
 * Anything missing returns null/empty — callers decide whether to merge.
 */
export function parseMasterOutput(raw: string): ParsedMasterOutput {
  const sections = splitSections(raw);

  const industryRaw = findSection(sections, "industry");
  const brandName = findSection(sections, "brand name", "brand").split("\n")[0]?.trim() || null;

  const palette = parseColorPalette(findSection(sections, "color palette", "colour palette", "palette"));
  const assetTags = parseAssetTags(findSection(sections, "asset tags", "brand assets guide", "brand assets"));

  const briefIdentity = findSection(sections, "brand identity", "identity");
  const briefMandatory = findSection(sections, "must-include elements", "must include elements", "mandatory elements", "mandatory");
  const briefVisual = findSection(sections, "visual direction", "visual dna", "visual style", "visual language");
  const briefCopy = findSection(sections, "example copy", "copy examples", "sample copy");

  const tone = findSection(sections, "tone & voice", "tone and voice", "tone", "voice");
  const audience = findSection(sections, "target audience", "audience");
  const voiceRules = [tone && `## TONE & VOICE\n${tone}`, audience && `## TARGET AUDIENCE\n${audience}`]
    .filter(Boolean)
    .join("\n\n");

  const visualNevers = findSection(sections, "visual nevers");
  const contentNevers = findSection(sections, "content nevers");
  // Fallback: if there's only a single "never list" / "the never list" section,
  // keep it as content nevers (safer — visual injection is more aggressive).
  const fallbackNevers = findSection(sections, "the never list", "never list", "nevers");

  return {
    industry: findIndustry(industryRaw) || findIndustry(brandName || "") || null,
    brandName,
    primaryColor: palette.primary,
    secondaryColor: palette.secondary,
    extraColors: palette.extras.slice(0, 8),
    assetTags,
    briefIdentity,
    briefMandatory,
    briefVisual,
    briefCopy,
    voiceRules,
    visualNevers: visualNevers || "",
    contentNevers: contentNevers || fallbackNevers || "",
  };
}

// ─── Never-list serialization (no DB migration needed) ──────────────────────

export interface SplitNevers {
  visual: string;
  content: string;
  /** Legacy plain-text content (used when no headers were found). */
  general: string;
}

/**
 * Read existing negative_prompts text and split into visual/content/general.
 * If the text contains "## VISUAL NEVERS" / "## CONTENT NEVERS" headers, use
 * them. Otherwise the whole thing becomes `general`.
 */
export function readNevers(raw: string | null | undefined): SplitNevers {
  if (!raw || !raw.trim()) return { visual: "", content: "", general: "" };
  const sections = splitSections(raw);
  const visual = (sections["visual nevers"] || "").trim();
  const content = (sections["content nevers"] || "").trim();
  if (visual || content) {
    return { visual, content, general: "" };
  }
  return { visual: "", content: "", general: raw.trim() };
}

/**
 * Serialize back to a single text blob for the negative_prompts column.
 * If both visual+content are empty but general is set, write general (legacy
 * round-trip). Otherwise emit headers.
 */
export function writeNevers(visual: string, content: string, general = ""): string {
  const v = visual.trim();
  const c = content.trim();
  const g = general.trim();
  if (!v && !c) return g;
  const parts: string[] = [];
  if (v) parts.push(`## VISUAL NEVERS\n${v}`);
  if (c) parts.push(`## CONTENT NEVERS\n${c}`);
  if (g) parts.push(`## GENERAL NEVERS\n${g}`);
  return parts.join("\n\n");
}
