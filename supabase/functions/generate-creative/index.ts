import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMAT_SPECS: Record<string, { width: number; height: number; label: string; aspectRatio: string }> = {
  landscape: { width: 1920, height: 1080, label: "landscape (1920×1080)", aspectRatio: "16:9" },
  square: { width: 1080, height: 1080, label: "square (1080×1080)", aspectRatio: "1:1" },
  story: { width: 1080, height: 1920, label: "portrait/story (1080×1920)", aspectRatio: "9:16" },
  portrait: { width: 1080, height: 1350, label: "portrait (1080×1350, 4:5)", aspectRatio: "4:5" },
};

// ─── kie.ai API configuration ───
const KIE_API_BASE = "https://api.kie.ai";
const KIE_CHAT_BASE = `${KIE_API_BASE}/gemini-3-flash/v1/chat/completions`;
const KIE_CREATE_TASK = `${KIE_API_BASE}/api/v1/jobs/createTask`;
const KIE_TASK_STATUS = `${KIE_API_BASE}/api/v1/jobs/recordInfo`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Extract width/height from PNG header bytes (first 24 bytes contain IHDR)
function extractPngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  if (bytes[0] !== 137 || bytes[1] !== 80 || bytes[2] !== 78 || bytes[3] !== 71) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  return { width, height };
}

// Also support JPEG dimension extraction
function extractJpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];
    if (marker === 0xC0 || marker === 0xC2) {
      if (offset + 9 < bytes.length) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const height = view.getUint16(offset + 5, false);
        const width = view.getUint16(offset + 7, false);
        return { width, height };
      }
      break;
    }
    if (offset + 3 >= bytes.length) break;
    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
    offset += 2 + segLen;
  }
  return null;
}

function extractImageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  return extractPngDimensions(bytes) || extractJpegDimensions(bytes);
}

function isAspectRatioMatch(
  actual: { width: number; height: number },
  requested: { width: number; height: number },
  tolerance = 0.05
): boolean {
  const expectedRatio = requested.width / requested.height;
  const actualRatio = actual.width / actual.height;
  return Math.abs(actualRatio - expectedRatio) / expectedRatio <= tolerance;
}

// ─── Fixed vocabulary for zone normalization ───
const NORM_ZONE_MAP: Record<string, string> = {
  logo: "brand_mark", brand_logo: "brand_mark", secondary_logo: "brand_mark",
  partner_logo: "brand_mark", logo_zone: "brand_mark", brand_mark: "brand_mark",
  headline: "headline", title: "headline", main_headline: "headline",
  headline_text: "headline", primary_text: "headline",
  subtext: "subcopy", subcopy: "subcopy", body_text: "subcopy", body: "subcopy",
  description: "subcopy", supporting_text: "subcopy", sub_headline: "subcopy",
  hero_image: "hero_visual", hero: "hero_visual", main_image: "hero_visual",
  product_image: "hero_visual", hero_visual: "hero_visual", primary_visual: "hero_visual",
  architecture: "hero_visual", render: "hero_visual", "3d_render": "hero_visual",
  supporting_image: "supporting_visual", secondary_image: "supporting_visual",
  supporting_visual: "supporting_visual", lifestyle_image: "supporting_visual",
  info_strip: "info_strip", details: "info_strip", information: "info_strip",
  event_details: "info_strip", event_details_card: "info_strip", info_grid: "info_strip",
  contact_info: "info_strip", details_card: "info_strip",
  cta: "cta", cta_button: "cta", button: "cta", call_to_action: "cta",
  footer: "footer", footer_bar: "footer", disclaimer: "footer", legal: "footer",
  background: "background", bg: "background", overlay: "background",
  accent: "accent", accent_strip: "accent", divider: "accent", separator: "accent",
  tagline: "accent", tag: "accent",
};

function normalizeZoneName(name: string): string {
  const key = name.toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  return NORM_ZONE_MAP[key] || "accent";
}

function parseStoredFramework(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function sanitizeFramework(fw: Record<string, unknown>): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(fw));

  if (clean.layout?.zones && Array.isArray(clean.layout.zones)) {
    for (const zone of clean.layout.zones) {
      if (zone.name) zone.name = normalizeZoneName(zone.name);
      if (zone.description) {
        const norm = zone.name || "accent";
        const descMap: Record<string, string> = {
          brand_mark: "brand logo placement zone",
          headline: "primary headline text zone",
          subcopy: "supporting text zone",
          hero_visual: "primary visual / imagery zone",
          supporting_visual: "secondary visual element zone",
          info_strip: "information strip with key details",
          cta: "call-to-action button or strip",
          footer: "footer / legal zone",
          background: "background zone",
          accent: "design accent element",
        };
        zone.description = descMap[norm] || "design element zone";
      }
    }
  }

  if (clean.text_elements && Array.isArray(clean.text_elements)) {
    for (const te of clean.text_elements) {
      delete te.content_description;
      if (te.type) {
        const t = te.type.toLowerCase();
        if (/headline|title/.test(t)) te.type = "headline";
        else if (/sub/.test(t)) te.type = "subcopy";
        else if (/cta|button/.test(t)) te.type = "cta";
        else if (/tag/.test(t)) te.type = "tagline";
        else if (/price|offer/.test(t)) te.type = "detail";
        else if (/disclaim|legal/.test(t)) te.type = "footer";
      }
    }
  }

  if (typeof clean.composition_notes === "string") {
    clean.composition_notes = clean.composition_notes
      .replace(/"[^"]*"/g, '"[text]"')
      .replace(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g, "[brand]")
      .replace(/\b[A-Z]{3,}\b/g, "[brand]")
      .replace(/\b[A-Z]{3}\s*[\d,.]+[MKBmkb]?\b/g, "[price]")
      .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:sq\.?\s*(?:ft|yds?|m)|acres?)\b/gi, "[size]")
      .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi, "[date]")
      .replace(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi, "[day]")
      .replace(/\+?\d[\d\s-]{7,}\d/g, "[phone]")
      .replace(/https?:\/\/\S+/g, "[url]")
      .replace(/www\.\S+/g, "[url]");
  }

  return clean;
}

function extractStoredCaption(copywriting: unknown): string {
  if (typeof copywriting === "string") return copywriting.trim();
  if (!copywriting || typeof copywriting !== "object") return "";
  const caption = (copywriting as Record<string, unknown>).caption;
  return typeof caption === "string" ? caption.trim() : "";
}

function toCompactText(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

// ─── kie.ai Chat API helper (OpenAI-compatible) ───
async function kieChat(
  apiKey: string,
  body: Record<string, unknown>,
  timeoutMs = 60000
): Promise<any> {
  const response = await fetch(KIE_CHAT_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    console.error(`kie.ai chat error ${response.status}:`, errText);
    if (response.status === 402) throw new Error("CREDITS_EXHAUSTED");
    if (response.status === 429) throw new Error("KIE_RATE_LIMITED");
    throw new Error(`kie.ai chat failed (${response.status})`);
  }

  return await response.json();
}

// ─── kie.ai Image Generation (async task API) ───
async function kieGenerateImage(
  apiKey: string,
  prompt: string,
  imageInputs: string[],
  aspectRatio: string,
  model = "nano-banana-2",
  resolution = "1K"
): Promise<string> {
  // Submit task
  const createRes = await fetch(KIE_CREATE_TASK, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: {
        prompt,
        image_input: imageInputs,
        aspect_ratio: aspectRatio,
        resolution,
        output_format: "png",
      },
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    console.error(`kie.ai createTask error ${createRes.status}:`, errText);
    if (createRes.status === 402) throw new Error("CREDITS_EXHAUSTED");
    if (createRes.status === 429) throw new Error("KIE_RATE_LIMITED");
    throw new Error(`kie.ai task creation failed (${createRes.status})`);
  }

  const createData = await createRes.json();
  const taskId = createData?.data?.taskId || createData?.taskId;
  if (!taskId) {
    console.error("No taskId in kie.ai response:", JSON.stringify(createData));
    throw new Error("No taskId returned from kie.ai");
  }

  console.log(`kie.ai task created: ${taskId} (model: ${model})`);

  // Poll for completion — max 3 minutes with exponential backoff
  const maxWaitMs = 180000;
  const startTime = Date.now();
  let pollInterval = 3000; // Start at 3s
  const maxPollInterval = 10000;

  while (Date.now() - startTime < maxWaitMs) {
    await sleep(pollInterval);

    const statusRes = await fetch(`${KIE_TASK_STATUS}?taskId=${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) {
      console.warn(`kie.ai poll error ${statusRes.status}, retrying...`);
      pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
      continue;
    }

    const statusData = await statusRes.json();
    const state = statusData?.data?.state;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    if (state === "success") {
      const resultJson = statusData.data.resultJson;
      let resultUrls: string[] = [];
      if (typeof resultJson === "string") {
        try {
          const parsed = JSON.parse(resultJson);
          resultUrls = parsed.resultUrls || [];
        } catch {
          console.error("Failed to parse resultJson:", resultJson);
        }
      } else if (resultJson?.resultUrls) {
        resultUrls = resultJson.resultUrls;
      }

      if (resultUrls.length === 0) {
        throw new Error("kie.ai task succeeded but no result URLs");
      }

      console.log(`kie.ai task ${taskId} completed in ${elapsed}s, got ${resultUrls.length} URLs`);
      return resultUrls[0];
    }

    if (state === "fail") {
      const failMsg = statusData.data?.failMsg || "Unknown failure";
      console.error(`kie.ai task ${taskId} failed after ${elapsed}s:`, failMsg);
      throw new Error(`kie.ai generation failed: ${failMsg}`);
    }

    // Still processing (waiting, queuing, generating)
    if (elapsed % 15 === 0) {
      console.log(`kie.ai task ${taskId} state: ${state}, elapsed: ${elapsed}s`);
    }
    pollInterval = Math.min(pollInterval * 1.2, maxPollInterval);
  }

  throw new Error(`kie.ai task ${taskId} timed out after ${maxWaitMs / 1000}s`);
}

// ─── Download image from URL and convert to base64 ───
async function downloadImageAsBase64(url: string): Promise<{ base64: string; bytes: Uint8Array }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  
  // Detect content type
  let mimeType = "image/png";
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) mimeType = "image/jpeg";
  else if (bytes[0] === 0x89 && bytes[1] === 0x50) mimeType = "image/png";
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) mimeType = "image/webp";
  
  // Convert to base64
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = `data:${mimeType};base64,${btoa(binary)}`;
  return { base64, bytes };
}

// ─── Creative direction moods for copy variation ───
// Each mood is tagged with traits so we can filter by brand tone.
type MoodEntry = {
  label: string;
  description: string;
  traits: string[]; // signals that make this mood appropriate
  forbiddenFor: string[]; // signals that disqualify this mood
};

const CREATIVE_MOODS: MoodEntry[] = [
  {
    label: "Bold & Confident",
    description: "Bold & Confident — use strong, declarative language with authority",
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

// Split a stored negative_prompts blob into visual / content / general parts.
// The form may store "## VISUAL NEVERS … ## CONTENT NEVERS …"; older rows
// remain plain text and are treated as "general" (used in both pipelines).
function splitNevers(raw: string | null | undefined): { visual: string; content: string; general: string } {
  if (!raw || !raw.trim()) return { visual: "", content: "", general: "" };
  const text = raw.trim();
  const visualMatch = text.match(/##\s*VISUAL NEVERS\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  const contentMatch = text.match(/##\s*CONTENT NEVERS\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  const generalMatch = text.match(/##\s*GENERAL NEVERS\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (visualMatch || contentMatch || generalMatch) {
    return {
      visual: (visualMatch?.[1] || "").trim(),
      content: (contentMatch?.[1] || "").trim(),
      general: (generalMatch?.[1] || "").trim(),
    };
  }
  return { visual: "", content: "", general: text };
}

// Derive 3-5 brand-appropriate moods from the brand's brief, voice rules, and negative prompts.
// Returns the descriptions to inject into the prompt.
function deriveBrandMoods(
  brief: string,
  voiceRules: string,
  negativePrompts: string,
): { allowed: MoodEntry[]; reason: string } {
  const corpus = `${brief}\n${voiceRules}`.toLowerCase();
  const negativeCorpus = negativePrompts.toLowerCase();

  // Find Tone & Voice section explicitly if present (gets a 2x weight boost)
  const toneSectionMatch = corpus.match(
    /(?:tone|voice|personality|brand voice|tone & voice|tone and voice)[\s\S]{0,1500}?(?:\n##|\n\*\*[A-Z]|$)/i,
  );
  const toneSection = toneSectionMatch ? toneSectionMatch[0] : "";

  const scored = CREATIVE_MOODS.map((mood) => {
    let score = 0;
    let disqualified = false;

    // Hard disqualifiers from negative prompts
    for (const forbidden of mood.forbiddenFor) {
      if (negativeCorpus.includes(forbidden)) {
        disqualified = true;
        break;
      }
    }
    if (disqualified) return { mood, score: -999 };

    // Soft disqualifiers from brief (if brief explicitly says "never playful", drop it)
    for (const forbidden of mood.forbiddenFor) {
      const neverPattern = new RegExp(`(?:never|avoid|not|no)\\s+\\w{0,20}\\s*${forbidden}`, "i");
      if (neverPattern.test(corpus)) {
        disqualified = true;
        break;
      }
    }
    if (disqualified) return { mood, score: -999 };

    // Score by trait matches in corpus (1pt each)
    for (const trait of mood.traits) {
      if (corpus.includes(trait)) score += 1;
      // Tone section matches count double
      if (toneSection && toneSection.includes(trait)) score += 1;
    }

    return { mood, score };
  });

  const eligible = scored.filter((s) => s.score > -999);

  // If brief has signal, take top-scoring moods (tied at top all included, then top 3-5)
  const withSignal = eligible.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);

  let allowed: MoodEntry[];
  let reason: string;

  if (withSignal.length >= 3) {
    // Take top 3-5 based on score distribution
    allowed = withSignal.slice(0, Math.min(5, withSignal.length)).map((s) => s.mood);
    reason = `derived from brand tone signals (${allowed.length} moods)`;
  } else if (withSignal.length > 0) {
    // Some signal — use those plus pad to 3 from neutral remainder
    const used = new Set(withSignal.map((s) => s.mood.label));
    const padding = eligible
      .filter((s) => !used.has(s.mood.label) && s.score === 0)
      .slice(0, 3 - withSignal.length)
      .map((s) => s.mood);
    allowed = [...withSignal.map((s) => s.mood), ...padding];
    reason = `partial brand signal + ${padding.length} neutral moods`;
  } else {
    // No tone signal at all — fall back to all eligible moods (filtered only by forbidden traits)
    allowed = eligible.map((s) => s.mood);
    reason = `no tone signal; all ${allowed.length} brand-safe moods`;
  }

  return { allowed, reason };
}

function pickMoodFromAllowed(allowed: MoodEntry[]): string {
  if (allowed.length === 0) {
    // Last-resort safety: shouldn't happen but fall back to all moods
    return CREATIVE_MOODS[Math.floor(Math.random() * CREATIVE_MOODS.length)].description;
  }
  return allowed[Math.floor(Math.random() * allowed.length)].description;
}

// ─────────────────────────────────────────────────────
// Step 1 — Analyze reference image design framework
// ─────────────────────────────────────────────────────

// Try to extract framework from a plain text/JSON response (fallback when tool_calls missing)
function extractFrameworkFromContent(content: string): Record<string, unknown> | null {
  if (!content) return null;
  
  // Try to find JSON block in the content
  const jsonPatterns = [
    /```json\s*([\s\S]*?)```/,
    /```\s*([\s\S]*?)```/,
    /\{[\s\S]*"layout"[\s\S]*"zones"[\s\S]*\}/,
  ];
  
  for (const pattern of jsonPatterns) {
    const match = content.match(pattern);
    if (match) {
      try {
        const parsed = JSON.parse(match[1] || match[0]);
        if (parsed && typeof parsed === "object" && (parsed.layout || parsed.style)) {
          console.log("Extracted framework from content text (fallback)");
          return parsed;
        }
      } catch { /* continue */ }
    }
  }
  
  // Try parsing entire content as JSON
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && (parsed.layout || parsed.style)) {
      return parsed;
    }
  } catch { /* not JSON */ }
  
  return null;
}

// Walk a string starting from `start`, return the index just AFTER the matching
// closing brace (quote- and escape-aware). Returns -1 if unbalanced.
function findBalancedBraceEnd(s: string, start: number): number {
  let depth = 0;
  let inStr = false;
  let strCh = "";
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === strCh) { inStr = false; }
      continue;
    }
    if (c === '"' || c === "'") { inStr = true; strCh = c; continue; }
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// Yield candidate JSON object substrings from `content`, in priority order:
//   1. fenced ```json blocks (balanced inside the fence)
//   2. balanced top-level { … } objects scanned from each `{`
function* candidateJsonBlocks(content: string): Generator<string> {
  // 1. Fenced blocks
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(content)) !== null) {
    const inner = m[1];
    const start = inner.indexOf("{");
    if (start !== -1) {
      const end = findBalancedBraceEnd(inner, start);
      if (end !== -1) yield inner.slice(start, end);
      else yield inner; // last-resort: try the whole fence body
    }
  }

  // 2. Every "{" in the raw content — try balanced extraction.
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== "{") continue;
    const end = findBalancedBraceEnd(content, i);
    if (end !== -1) {
      yield content.slice(i, end);
      // skip past this object so we don't scan its inner braces redundantly
      i = end - 1;
    }
  }
}

// Extract a creative directive from plain-text/JSON content (Adapt step fallback).
// Resilient to trailing markdown / prose after the JSON object — uses a
// quote-aware balanced-brace scanner instead of a greedy regex.
function extractDirectiveFromContent(content: string): CreativeDirective | null {
  if (!content) return null;

  const normalize = (parsed: any): CreativeDirective | null => {
    if (!parsed || typeof parsed !== "object" || !parsed.headline) return null;
    return {
      headline: parsed.headline || "",
      subcopy: parsed.subcopy || parsed.sub_copy || parsed.subheadline || "",
      cta_text: parsed.cta_text || parsed.cta || "Learn More",
      selected_assets: parsed.selected_assets || [],
      color_usage: parsed.color_usage || {
        background: "#FFFFFF",
        headline_color: "#000000",
        subcopy_color: "#333333",
        cta_background: "#000000",
        cta_text: "#FFFFFF",
      },
      concept_adaptation: parsed.concept_adaptation || "",
      logo_treatment: parsed.logo_treatment || "",
      compliance_notes: parsed.compliance_notes || "",
    } as CreativeDirective;
  };

  for (const candidate of candidateJsonBlocks(content)) {
    try {
      const parsed = JSON.parse(candidate);
      const d = normalize(parsed);
      if (d) {
        console.log("Extracted directive via balanced-brace scan");
        return d;
      }
    } catch { /* keep scanning */ }
  }

  // Last resort: try parsing the entire content
  try {
    const d = normalize(JSON.parse(content));
    if (d) return d;
  } catch { /* not JSON */ }

  return null;
}

// Build a minimal fallback framework from the format spec
function buildMinimalFramework(aspectRatio: string): Record<string, unknown> {
  const orientation = aspectRatio === "1:1" ? "square" 
    : aspectRatio === "9:16" || aspectRatio === "4:5" ? "portrait" 
    : "landscape";
  
  return {
    layout: {
      orientation,
      zones: [
        { name: "background", position: "full", size: "full", description: "background zone" },
        { name: "brand_mark", position: "top-left", size: "small", description: "brand logo placement zone" },
        { name: "headline", position: "center", size: "large", description: "primary headline text zone" },
        { name: "subcopy", position: "center-bottom", size: "medium", description: "supporting text zone" },
        { name: "hero_visual", position: "center", size: "large", description: "primary visual / imagery zone" },
        { name: "cta", position: "bottom-center", size: "small", description: "call-to-action button or strip" },
      ],
    },
    style: {
      background_type: "gradient",
      photography_style: "lifestyle",
      overlay: "dark-gradient",
      mood: "professional",
      color_scheme: "dominant brand primary with neutral accents",
    },
    text_elements: [
      { type: "headline", position: "center", font_style: "bold uppercase sans-serif", approximate_size: "large" },
      { type: "subcopy", position: "below-headline", font_style: "light sans-serif", approximate_size: "medium" },
      { type: "cta", position: "bottom-center", font_style: "bold uppercase", approximate_size: "small" },
    ],
    composition_notes: "Standard brand layout with clear visual hierarchy, logo prominence, and balanced text placement.",
  };
}

async function analyzeFramework(
  referenceImageUrl: string,
  apiKey: string,
  aspectRatio = "16:9"
): Promise<Record<string, unknown>> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Framework analysis attempt ${attempt}/${maxRetries}...`);

      // For retry attempts, try converting image to base64 data URL
      let imageContent: any;
      if (attempt >= 2 && !referenceImageUrl.startsWith("data:")) {
        try {
          console.log("Attempting base64 conversion for image input...");
          const { base64 } = await downloadImageAsBase64(referenceImageUrl);
          imageContent = { type: "image_url", image_url: { url: base64 } };
        } catch (dlErr) {
          console.warn("Base64 conversion failed, using URL:", dlErr);
          imageContent = { type: "image_url", image_url: { url: referenceImageUrl } };
        }
      } else {
        imageContent = { type: "image_url", image_url: { url: referenceImageUrl } };
      }

      const data = await kieChat(apiKey, {
        messages: [
          {
            role: "system",
            content: `You are an expert visual design analyst specializing in ABSTRACT DESIGN PRINCIPLES.

CRITICAL RULES:
1. Describe layout zones by their DESIGN ROLE — NOT by their content.
2. NEVER mention brand names, company names, product names, locations, dates, prices, phone numbers, or any specific text visible in the image.
3. Use ONLY these zone_type categories: background, brand_mark, headline, subcopy, hero_visual, supporting_visual, info_strip, cta, footer, accent
4. Describe SPATIAL RELATIONSHIPS, visual weight, and compositional principles — not what specific content fills each zone.
5. For text_elements, describe the TYPOGRAPHIC STYLE (weight, case, size, contrast) — never the actual words.
6. Think of yourself as extracting a REUSABLE TEMPLATE, not describing this specific ad.

Example of WRONG zone description: "AEON & TRISL logo in white"
Example of RIGHT zone description: "brand mark placement, white on dark, high contrast"

Example of WRONG composition note: "Open house event with date and venue details"  
Example of RIGHT composition note: "Information strip with 3-4 short data points, left-aligned"`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the ABSTRACT DESIGN FRAMEWORK from this advertisement. Focus on spatial layout, visual hierarchy, typographic style, and compositional principles. Do NOT describe any specific content — only design structure.",
              },
              imageContent,
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_design_framework",
              description:
                "Extract a reusable, content-agnostic design framework from the reference image.",
              parameters: {
                type: "object",
                properties: {
                  layout: {
                    type: "object",
                    properties: {
                      orientation: {
                        type: "string",
                        description: "landscape, portrait, or square",
                      },
                      zones: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            name: {
                              type: "string",
                              enum: [
                                "background", "brand_mark", "headline", "subcopy",
                                "hero_visual", "supporting_visual", "info_strip",
                                "cta", "footer", "accent",
                              ],
                              description: "Abstract zone type from the fixed vocabulary",
                            },
                            position: { type: "string", description: "Precise position: top-left, center, bottom-right, etc." },
                            size: { type: "string", description: "Relative size: tiny, small, medium, large, half, full" },
                            description: { type: "string", description: "DESIGN ROLE description only — NEVER mention specific content." },
                          },
                          required: ["name", "position", "size", "description"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["orientation", "zones"],
                    additionalProperties: false,
                  },
                  style: {
                    type: "object",
                    properties: {
                      background_type: { type: "string", description: "solid, gradient, photo, pattern, split, etc." },
                      photography_style: { type: "string", description: "lifestyle, product-shot, abstract, illustration, architectural, none" },
                      overlay: { type: "string", description: "Overlay treatment: none, dark-gradient, light-gradient, color-wash, etc." },
                      mood: { type: "string", description: "Overall mood: professional, playful, luxurious, energetic, minimalist, etc." },
                      color_scheme: { type: "string", description: "Color relationships — dominant/accent/neutral distribution, NOT specific brand colors" },
                    },
                    required: ["background_type", "photography_style", "overlay", "mood", "color_scheme"],
                    additionalProperties: false,
                  },
                  text_elements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["headline", "subcopy", "cta", "tagline", "detail", "footer"] },
                        position: { type: "string" },
                        font_style: { type: "string", description: "bold, light, italic, uppercase, condensed, serif, sans-serif, display, etc." },
                        approximate_size: { type: "string", description: "small, medium, large, extra-large" },
                      },
                      required: ["type", "position", "font_style", "approximate_size"],
                      additionalProperties: false,
                    },
                  },
                  composition_notes: {
                    type: "string",
                    description: "Abstract design observations about symmetry, focal point, whitespace, visual flow, contrast strategy. NEVER mention specific content.",
                  },
                },
                required: ["layout", "style", "text_elements", "composition_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_design_framework" } },
      }, 90000); // increased timeout for image analysis

      // Try extracting from tool_calls first
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        const framework = JSON.parse(toolCall.function.arguments);
        console.log("Framework extracted via tool_calls successfully");
        return framework;
      }

      // Fallback: try extracting from message content
      const messageContent = data.choices?.[0]?.message?.content;
      if (messageContent) {
        console.warn("No tool_calls in response, trying content extraction fallback...");
        console.log("Response content preview:", typeof messageContent === "string" ? messageContent.slice(0, 200) : JSON.stringify(messageContent).slice(0, 200));
        const extracted = extractFrameworkFromContent(
          typeof messageContent === "string" ? messageContent : JSON.stringify(messageContent)
        );
        if (extracted) return extracted;
      }

      // Log the actual response structure for debugging
      console.error(`Attempt ${attempt}: No framework in response. Keys: ${JSON.stringify(Object.keys(data || {}))}`);
      if (data.choices?.[0]?.message) {
        const msg = data.choices[0].message;
        console.error(`Message keys: ${JSON.stringify(Object.keys(msg))}, role: ${msg.role}, has content: ${!!msg.content}, has tool_calls: ${!!msg.tool_calls}`);
      }
      
      lastError = new Error("No framework extracted from reference image");
    } catch (err: any) {
      lastError = err;
      console.error(`Framework analysis attempt ${attempt} error:`, err.message);
      
      if (err.message === "CREDITS_EXHAUSTED" || err.message === "KIE_RATE_LIMITED") throw err;
      
      if (attempt < maxRetries) {
        const waitMs = 3000 * attempt;
        console.log(`Waiting ${waitMs}ms before retry...`);
        await sleep(waitMs);
      }
    }
  }

  // Final fallback: use a minimal generic framework so generation can still proceed
  console.warn("⚠️ All framework analysis attempts failed. Using minimal fallback framework.");
  return buildMinimalFramework(aspectRatio);
}

// ─────────────────────────────────────────────────────
// Step 2 — Adapt: Map reference concept to brand
// ─────────────────────────────────────────────────────
interface CreativeDirective {
  headline: string;
  subcopy: string;
  cta_text: string;
  selected_assets: Array<{
    index: number;
    role: string;
    placement: string;
    reason: string;
  }>;
  color_usage: {
    background: string;
    headline_color: string;
    subcopy_color: string;
    cta_background: string;
    cta_text: string;
  };
  concept_adaptation: string;
  logo_treatment: string;
  compliance_notes: string;
}

const ASSET_ROLE_INSTRUCTIONS: Record<string, string> = {
  "Logo": "Place as brand mark — exact fidelity required. Top-left or top-right with contrast backing.",
  "Hero Image": "Use as the primary hero visual. Feature prominently in the main visual zone.",
  "Product": "Feature prominently with high detail preservation. Center of visual attention.",
  "Lifestyle": "Use as atmospheric background or lifestyle context. Can crop/blend into layout.",
  "Icon": "Small supporting element. Use at specified position, maintain clarity.",
  "Pattern/Texture": "Use as background texture, border accent, or subtle overlay pattern.",
  "Banner": "Use as a full-width visual strip or header element.",
  "Infographic": "Include as data/information visual. Maintain readability.",
  "Style Reference": "Use as mood/style guide — match its aesthetic, don't reproduce literally.",
  "Elevation": "Use as hero architectural visual. Preserve exact building form, materials, and proportions.",
  "Interior": "Showcase interior space. Preserve design details, furniture, and spatial feel.",
  "Exterior": "Feature building/project exterior. Maintain architectural accuracy and surroundings.",
  "Amenity": "Showcase project amenity (pool, gym, garden). Feature prominently with lifestyle appeal.",
  "RERA QR": "Place as regulatory compliance element. Position in top-right or bottom corner, keep scannable.",
  "Render": "Use as hero 3D render. Preserve exact form, lighting, and materials.",
  "Room/Suite": "Feature the space prominently. Preserve luxury/comfort feel.",
  "Aerial View": "Use as dramatic top-down or elevated perspective visual.",
  "Lookbook": "Use as fashion editorial visual. Maintain styling and composition.",
  "On-Model": "Feature model wearing product. Preserve outfit details.",
  "Swatch": "Use as color/material reference element. Place in supporting zone.",
  "Flat Lay": "Use as product arrangement visual. Maintain composition.",
  "Fabric Close-up": "Use as texture/detail reference. Supporting visual element.",
  "Screenshot": "Use as product UI showcase. Maintain sharpness and readability.",
  "UI Mockup": "Feature as product interface visual. Keep pixel-perfect.",
  "Device Render": "Showcase product on device. Maintain device frame and screen content.",
  "Dashboard": "Feature as product analytics/interface visual.",
  "Dish/Menu Item": "Feature food prominently. Preserve appetizing presentation.",
  "Packaging": "Showcase product packaging. Maintain label details and branding.",
  "Store/Venue": "Feature retail/venue space. Preserve atmosphere.",
  "Facility": "Showcase facility/building. Maintain professional look.",
  "Data Visualization": "Include as chart/graph element. Maintain readability.",
  "Other": "Use in appropriate zone based on visual content.",
};

function getAssetRoleInstruction(label: string): string {
  if (label.startsWith("Other:")) {
    const customDesc = label.replace(/^Other:\s*/, "").trim();
    return customDesc
      ? `Use as "${customDesc}" — place in appropriate zone based on this description.`
      : ASSET_ROLE_INSTRUCTIONS["Other"];
  }
  return ASSET_ROLE_INSTRUCTIONS[label] || ASSET_ROLE_INSTRUCTIONS["Other"];
}

async function adaptDirective(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  referenceImageUrl: string,
  spec: { width: number; height: number; label: string },
  apiKey: string
): Promise<CreativeDirective> {
  const extraColorsText =
    brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
      ? brand.extra_colors.map((c: any) => `${c.name || "Color"}: ${c.hex}`).join(", ")
      : "";

  const assetList = brandAssets
    .map(
      (a: any, i: number) =>
        `[${i}] "${a.label || "Unlabeled"}" — Role: ${getAssetRoleInstruction(a.label || "")}`
    )
    .join("\n");

  const nevers = splitNevers(brand.negative_prompts);
  // Mood derivation = content-side signal (visual nevers shouldn't disqualify "Playful").
  const moodNeverCorpus = [nevers.content, nevers.general].filter(Boolean).join("\n");

  const brandContext = [
    `Brand: ${brand.name}`,
    `Primary: ${brand.primary_color} | Secondary: ${brand.secondary_color}`,
    extraColorsText ? `Extra colors: ${extraColorsText}` : "",
    brand.brand_voice_rules ? `Voice/Audience: ${toCompactText(brand.brand_voice_rules, 4000)}` : "",
    brand.brand_brief ? `Brand Brief: ${toCompactText(brand.brand_brief, 8000)}` : "",
    nevers.content ? `CONTENT NEVERS (copy): ${toCompactText(nevers.content, 2000)}` : "",
    nevers.visual ? `VISUAL NEVERS (image): ${toCompactText(nevers.visual, 2000)}` : "",
    nevers.general ? `NEVER include: ${toCompactText(nevers.general, 3000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const { allowed: allowedMoods, reason: moodReason } = deriveBrandMoods(
    brand.brand_brief || "",
    brand.brand_voice_rules || "",
    moodNeverCorpus,
  );
  const creativeMood = pickMoodFromAllowed(allowedMoods);
  console.log(
    `[Adapt] Brand "${brand.name}" mood pool: ${moodReason}. Allowed: [${allowedMoods.map((m) => m.label).join(", ")}]. Picked: "${creativeMood.split(" — ")[0]}"`,
  );

  const systemPrompt = `You are a senior creative director. Your job is to MAP a reference advertisement's concept, layout, and energy to a specific brand — making every creative decision so the image model only needs to render.

CRITICAL — CONTENT ISOLATION:
The reference image is for LAYOUT, COMPOSITION, and VISUAL STYLE only.
IGNORE ALL text, names, locations, prices, currencies, phone numbers, addresses, URLs, and any written content visible in the reference image.
ALL copy (headline, subcopy, CTA) must come EXCLUSIVELY from the brand data below.

CRITICAL — IMAGE ISOLATION:
NEVER reproduce, copy, or recreate the IMAGERY from the reference image. The reference shows a layout structure — but ALL visuals in the output must come from the brand's OWN uploaded assets. If the reference shows people, buildings, products, or scenes — do NOT generate similar-looking imagery. Instead, select the brand's own assets that best fit each visual zone. The reference dictates WHERE images go and HOW they're composed, NOT WHAT images to use.

CREATIVE DIRECTION FOR THIS GENERATION:
${creativeMood}
Write copy that embodies this mood. Do NOT just repeat the brand's tagline — interpret the brand brief through this creative lens. Each generation should feel fresh and different.

You receive:
1. A reference advertisement image (for concept/style/layout inspiration ONLY)
2. The extracted design framework (structural analysis of the reference)
3. Full brand data (name, colors, voice, brief)
4. The actual brand asset images — you can SEE each one to evaluate visual fit
5. The output format/dimensions

Your task:
- Write the EXACT headline (≤8 words), subcopy (≤20 words), and CTA text — sourced ONLY from brand data
- Select which 2-4 assets (by index) to use, evaluating visual fit with the reference layout
- Decide exact color hex values for each element
- Explain how the reference concept adapts to this brand
- Specify logo treatment (light/dark version, backing panel if needed)
- Flag any compliance concerns from the brand brief

ASSET SELECTION RULES:
- Always include ONE logo if available
- VISUALLY MATCH assets to the reference layout zones
- Pick 1-3 visual assets (not just one!) if the reference has multiple visual zones
- Each visual zone in the reference should map to a DIFFERENT asset
- Skip assets that don't fit this layout
- Maximum 5 assets total (1 logo + up to 4 visuals)

COPY RULES:
- Headlines must be original, punchy, and aligned to the CREATIVE DIRECTION above
- ALL text MUST come from the brand brief and brand data
- CTA should be actionable and brand-appropriate
- DO NOT repeat the same headlines across generations — be creative and varied

COLOR RULES:
- Use brand primary for dominant elements (headlines, accent strips, CTA)
- Use secondary for supporting elements
- Ensure sufficient contrast for text readability

TEXT PLACEMENT:
- Text MUST be on solid color zones, gradient overlays, or panels — NEVER on photos/renders

FORMAT: ${spec.label} (${spec.width}×${spec.height})`;

  const userMessage = `DESIGN FRAMEWORK (abstract structural analysis — zone names are normalized):
${JSON.stringify(sanitizeFramework(framework), null, 2)}

BRAND DATA:
${brandContext}

AVAILABLE ASSETS (select by index — you can see each one below):
${assetList || "No assets available — design must be text-prominent."}

Look at the reference image AND each brand asset image. Visually evaluate which assets best fit the reference layout zones. Pre-decide all copy, colors, and asset selections.`;

  const userContent: any[] = [
    { type: "text", text: userMessage },
    { type: "text", text: "REFERENCE IMAGE (layout/style inspiration only — ignore all text/content in it):" },
    { type: "image_url", image_url: { url: referenceImageUrl } },
  ];

  for (let i = 0; i < brandAssets.length && i < 15; i++) {
    const asset = brandAssets[i];
    userContent.push(
      { type: "text", text: `BRAND ASSET [${i}] "${asset.label || "Unlabeled"}":` },
      { type: "image_url", image_url: { url: asset.image_url } }
    );
  }

  // Retry adapt step up to 2 times
  let lastAdaptError: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      if (attempt > 1) console.log(`Adapt step retry attempt ${attempt}...`);
      
      const data = await kieChat(apiKey, {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "creative_directive",
              description: "Output the complete creative directive mapping the reference concept to the brand.",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: "Exact headline text, ≤8 words" },
                  subcopy: { type: "string", description: "Exact subcopy text, ≤20 words" },
                  cta_text: { type: "string", description: "Exact CTA text" },
                  selected_assets: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        role: { type: "string" },
                        placement: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["index", "role", "placement", "reason"],
                      additionalProperties: false,
                    },
                  },
                  color_usage: {
                    type: "object",
                    properties: {
                      background: { type: "string" },
                      headline_color: { type: "string" },
                      subcopy_color: { type: "string" },
                      cta_background: { type: "string" },
                      cta_text: { type: "string" },
                    },
                    required: ["background", "headline_color", "subcopy_color", "cta_background", "cta_text"],
                    additionalProperties: false,
                  },
                  concept_adaptation: { type: "string" },
                  logo_treatment: { type: "string" },
                  compliance_notes: { type: "string" },
                },
                required: ["headline", "subcopy", "cta_text", "selected_assets", "color_usage", "concept_adaptation", "logo_treatment", "compliance_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "creative_directive" } },
      }, 90000);

      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        // Try content fallback — use directive-specific extractor
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const contentStr = typeof content === "string" ? content : JSON.stringify(content);
          console.warn("Adapt: No tool_calls, trying directive content extraction...");
          console.log("Adapt response content preview:", contentStr.slice(0, 300));
          const extracted = extractDirectiveFromContent(contentStr);
          if (extracted) {
            console.log("Adapt: Successfully extracted directive from content fallback");
            // Force-include logo
            const hasLogoSelected = extracted.selected_assets?.some(
              (sa) => sa.role.toLowerCase() === "logo"
            );
            if (!hasLogoSelected) {
              const logoIndex = brandAssets.findIndex((a: any) => /\b(logo|logomark|brand\s*mark|brand\s*logo|symbol|monogram|emblem)\b/i.test(a.label || ""));
              if (logoIndex >= 0) {
                console.log(`Force-adding logo asset at index ${logoIndex}`);
                extracted.selected_assets = [
                  { index: logoIndex, role: "logo", placement: "top-left corner, with contrast backing if needed", reason: "Force-included: brand logo must appear" },
                  ...(extracted.selected_assets || []),
                ];
              }
            }
            return extracted;
          }
        }
        throw new Error("No directive extracted from Adapt step");
      }

      const directive: CreativeDirective = JSON.parse(toolCall.function.arguments);
      console.log("Adapt directive:", JSON.stringify({
        headline: directive.headline,
        subcopy: directive.subcopy,
        cta: directive.cta_text,
        assetsSelected: directive.selected_assets?.length ?? 0,
      }));

      // Force-include logo if brand has one but directive didn't select it
      const hasLogoSelected = directive.selected_assets?.some(
        (sa) => sa.role.toLowerCase() === "logo"
      );
      if (!hasLogoSelected) {
        const logoIndex = brandAssets.findIndex((a: any) => /\b(logo|logomark|brand\s*mark|brand\s*logo|symbol|monogram|emblem)\b/i.test(a.label || ""));
        if (logoIndex >= 0) {
          console.log(`Force-adding logo asset at index ${logoIndex} (Adapt step missed it)`);
          directive.selected_assets = [
            { index: logoIndex, role: "logo", placement: "top-left corner, with contrast backing if needed", reason: "Force-included: brand logo must appear" },
            ...(directive.selected_assets || []),
          ];
        }
      }

      return directive;
    } catch (err: any) {
      lastAdaptError = err;
      console.error(`Adapt attempt ${attempt} failed:`, err.message);
      if (err.message === "CREDITS_EXHAUSTED" || err.message === "KIE_RATE_LIMITED") throw err;
      if (attempt < 2) await sleep(3000);
    }
  }

  throw lastAdaptError || new Error("Adapt step failed");
}

// ─────────────────────────────────────────────────────
// Step 3 — Generate creative using kie.ai image API
// ─────────────────────────────────────────────────────
function buildDirectivePrompt(
  directive: CreativeDirective,
  framework: Record<string, unknown>,
  brand: any,
  selectedAssets: any[],
  spec: { width: number; height: number; label: string; aspectRatio: string }
): string {
  const aspectRatioLabel = spec.aspectRatio;

  const assetRoleLines = directive.selected_assets
    .map((sa) => {
      const matchedAsset = selectedAssets.find((a: any) =>
        (a._originalIndex ?? -1) === sa.index
      );
      const assetLabel = matchedAsset ? (matchedAsset.label || "Asset") : `Asset #${sa.index}`;
      const roleHint = getAssetRoleInstruction(assetLabel);
      return `  • [${sa.role.toUpperCase()}] "${assetLabel}" → ${sa.placement} | ${roleHint}`;
    })
    .join("\n");

  const _nevers = splitNevers(brand.negative_prompts);
  // Image prompt = visual nevers + general (legacy). Content nevers go to copy only.
  const negativePrompts = toCompactText([_nevers.visual, _nevers.general].filter(Boolean).join(" "), 3000);

  return `⚠️⚠️⚠️ CRITICAL — OUTPUT SIZE IS ${spec.width}x${spec.height} PIXELS (${aspectRatioLabel}). THIS IS THE #1 RULE. ⚠️⚠️⚠️

CONTENT ISOLATION: Reference image (IMAGE 1) = LAYOUT ONLY. Copy NO text/names/locations from it.
IMAGE ISOLATION: NEVER reproduce reference imagery. ALL visuals must come from the brand asset images provided below.

═══ CREATIVE DIRECTIVE ═══
HEADLINE: "${directive.headline}"
SUBCOPY: "${directive.subcopy}"
CTA: "${directive.cta_text}"

COLORS: bg ${directive.color_usage.background} | headline ${directive.color_usage.headline_color} | subcopy ${directive.color_usage.subcopy_color} | CTA bg ${directive.color_usage.cta_background} text ${directive.color_usage.cta_text}

ASSETS:
${assetRoleLines}

CONCEPT: ${directive.concept_adaptation}
LOGO: ${directive.logo_treatment}

═══ RULES ═══
• Follow reference layout/composition/energy — adapt with brand assets + colors. NEVER recreate or imitate reference imagery
• Logo: reproduce EXACT letterforms, shapes, colors from the provided logo image. NEVER write "LOGO" as text
• Architecture/3D: preserve exact building geometry. May enhance lighting/angle
• Text on solid zones or panels only — NEVER on photos/renders
• Headline bold + large, subcopy medium, CTA clean. Max 3 hierarchy levels
• If logo contains brand name, do NOT repeat as text
${negativePrompts ? `• ⛔ NEVER: ${negativePrompts}` : ""}

⚠️⚠️⚠️ FINAL CHECK: Output MUST be ${spec.width}x${spec.height} pixels (${aspectRatioLabel}). Generate NOW.`;
}

function buildFallbackPrompt(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  spec: { width: number; height: number; label: string; aspectRatio: string }
): string {
  const extraColorsText =
    brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
      ? `Additional Colors:\n${brand.extra_colors.map((c: any) => `  - ${c.name || "Unnamed"}: ${c.hex}`).join("\n")}`
      : "";

  const brandVoice = toCompactText(brand.brand_voice_rules, 4000);
  const _fbNevers = splitNevers(brand.negative_prompts);
  const negativePrompts = toCompactText([_fbNevers.visual, _fbNevers.general].filter(Boolean).join(" "), 3000);
  const brandBrief = toCompactText(brand.brand_brief, 8000);

  const brandContext = [
    `Brand Name: ${brand.name}`,
    `Primary Color: ${brand.primary_color}`,
    `Secondary Color: ${brand.secondary_color}`,
    extraColorsText,
    brandVoice ? `Tone & Audience: ${brandVoice}` : "",
    negativePrompts ? `STRICT EXCLUSIONS (never include these): ${negativePrompts}` : "",
    brandBrief ? `Brand Guidelines & Brief: ${brandBrief}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const selectedAssets = brandAssets.slice(0, 5);
  const hasAssets = selectedAssets.length > 0;

  const logoAssets = selectedAssets.filter((a: any) => /\b(logo|logomark|brand\s*mark|brand\s*logo|symbol|monogram|emblem)\b/i.test(a.label || ""));
  const architectureAssets = selectedAssets.filter((a: any) =>
    /architect|3d|render|building|elevation|facade/i.test(a.label || "")
  );
  const heroAssets = selectedAssets.filter((a: any) =>
    /hero|lifestyle|product|mascot|master/i.test(a.label || "")
  );
  const otherAssets = selectedAssets.filter(
    (a: any) =>
      !logoAssets.includes(a) && !architectureAssets.includes(a) && !heroAssets.includes(a)
  );

  const assetRoleDescriptions = [
    ...logoAssets.map((a: any) => `  🔷 LOGO: "${a.label || "Logo"}" — Place in brand mark zone.`),
    ...architectureAssets.map((a: any) => `  🏗️ 3D RENDER: "${a.label || "Architecture"}" — Hero visual.`),
    ...heroAssets.map((a: any) => `  🖼️ HERO: "${a.label || "Visual"}" — Primary/secondary visual.`),
    ...otherAssets.map((a: any) => `  📎 ASSET: "${a.label || "Asset"}" — Use in appropriate zone.`),
  ].join("\n");

  const aspectRatioLabel = spec.aspectRatio;
  const frameworkJson = JSON.stringify(sanitizeFramework(framework), null, 2);

  return `⚠️⚠️⚠️ CRITICAL — OUTPUT SIZE IS ${spec.width}×${spec.height} PIXELS (${aspectRatioLabel}). THIS IS THE #1 RULE. ⚠️⚠️⚠️

CONTENT ISOLATION: The reference image (IMAGE 1) is for LAYOUT and VISUAL STYLE only. NEVER copy any text, names, locations, prices, currencies from it. ALL text comes from brand data below.
IMAGE ISOLATION: NEVER reproduce, copy, or recreate imagery from the reference. ALL visuals must come from the brand's own uploaded assets.

═══ DESIGN DIRECTION ═══
Follow the reference image's layout, composition, and visual energy. Adapt it to the brand assets and colors below.

LOGO: The brand logo is provided as a separate labeled image. Study it carefully and reproduce its EXACT letterforms, icon shapes, colors, and proportions. NEVER write "LOGO" as text.
TEXT PLACEMENT: Text MUST be on solid color zones, gradient overlays, or dedicated panels — NEVER on photos/renders.
TYPOGRAPHY: Headline ≤8 words bold. Subcopy ≤20 words. CTA clean. All text legible.

═══ BRAND DATA ═══
${brandContext}
${brandBrief ? `\nBrand Brief instructions are MANDATORY.` : ""}
${negativePrompts ? `\n⛔ NEVER INCLUDE: ${negativePrompts}` : ""}

═══ REFERENCE FRAMEWORK ═══
${frameworkJson}

${hasAssets ? `BRAND ASSETS (${selectedAssets.length} images provided after reference):
${assetRoleDescriptions}` : `No assets. Use "${brand.name}" text with brand colors.`}

⚠️⚠️⚠️ FINAL CHECK: Output MUST be ${spec.width}×${spec.height} pixels (${aspectRatioLabel}). Generate NOW.`;
}


// ─── Image generation via kie.ai async task API ───
async function generateCreative(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  referenceImageUrl: string,
  spec: { width: number; height: number; label: string; aspectRatio: string },
  apiKey: string,
  directive: CreativeDirective | null
): Promise<{ imageBase64: string; captionText: string }> {
  let systemPrompt: string;
  let selectedAssets: any[];

  if (directive) {
    const validIndices = directive.selected_assets
      .map((sa) => sa.index)
      .filter((i) => i >= 0 && i < brandAssets.length);
    selectedAssets = validIndices.map((i) => {
      return { ...brandAssets[i], _originalIndex: i };
    });

    if (selectedAssets.length === 0 && brandAssets.length > 0) {
      selectedAssets = brandAssets.slice(0, 3).map((a: any, i: number) => ({ ...a, _originalIndex: i }));
    }

    systemPrompt = buildDirectivePrompt(directive, framework, brand, selectedAssets, spec);
  } else {
    selectedAssets = brandAssets.slice(0, 5);
    systemPrompt = buildFallbackPrompt(framework, brand, brandAssets, spec);
  }

  // Build the full prompt text for kie.ai image generation
  // Include the system prompt + asset descriptions
  const promptParts: string[] = [systemPrompt];

  // Add reference image instruction
  promptParts.push("\nREFERENCE IMAGE: Use the first image_input as layout/style reference only — ignore all text/logos/names visible in it.");

  // Collect all image URLs for image_input
  const imageInputUrls: string[] = [referenceImageUrl];

  if (directive) {
    const sortedAssets = [...directive.selected_assets].sort((a, b) => {
      const aIsLogo = a.role.toUpperCase() === "LOGO" ? 0 : 1;
      const bIsLogo = b.role.toUpperCase() === "LOGO" ? 0 : 1;
      return aIsLogo - bIsLogo;
    });

    for (const sa of sortedAssets) {
      const asset = selectedAssets.find((a: any) => (a._originalIndex ?? -1) === sa.index);
      if (!asset) continue;
      const roleLabel = sa.role.toUpperCase();
      const imgNum = imageInputUrls.length + 1;
      if (roleLabel === "LOGO") {
        promptParts.push(`\nIMAGE ${imgNum} — BRAND LOGO: Study this carefully — reproduce its exact letterforms, colors, shapes, and proportions. This is the ONLY logo to use.`);
      } else {
        promptParts.push(`\nIMAGE ${imgNum} — ${roleLabel}: ${sa.placement}`);
      }
      imageInputUrls.push(asset.image_url);
    }
  } else {
    for (const asset of selectedAssets) {
      const isLogo = /\b(logo|logomark|brand\s*mark|brand\s*logo|symbol|monogram|emblem)\b/i.test(asset.label || "");
      const roleHint = isLogo ? "BRAND LOGO — must appear in output" : `BRAND ASSET (${(asset.label || "Asset").toUpperCase()})`;
      const imgNum = imageInputUrls.length + 1;
      promptParts.push(`\nIMAGE ${imgNum} — ${roleHint}`);
      imageInputUrls.push(asset.image_url);
    }
  }

  promptParts.push(`\n⚠️ FINAL REMINDER — OUTPUT DIMENSIONS: This image MUST be ${spec.aspectRatio} aspect ratio (${spec.width}×${spec.height} pixels). Do NOT match the reference image dimensions.`);

  const fullPrompt = promptParts.join("\n");

  // Model fallback plan for kie.ai
  const modelPlan = [
    { model: "nano-banana-2", label: "Nano Banana 2", resolution: "1K" },
    { model: "nano-banana-pro", label: "Nano Banana Pro", resolution: "1K" },
    { model: "nano-banana", label: "Nano Banana", resolution: "1K" },
  ];

  let lastError: Error | null = null;

  for (const { model, label, resolution } of modelPlan) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      console.log(`Using model: ${label} @ ${resolution} (attempt ${attempt}/2)`);

      try {
        const resultUrl = await kieGenerateImage(
          apiKey,
          fullPrompt,
          imageInputUrls,
          spec.aspectRatio,
          model,
          resolution
        );

        // Download the generated image
        console.log(`Downloading generated image from kie.ai...`);
        const { base64, bytes } = await downloadImageAsBase64(resultUrl);

        const dims = extractImageDimensions(bytes);
        if (dims) {
          console.log(`[${label}] Generated image: ${dims.width}×${dims.height}`);
        }

        const captionText = directive
          ? `${directive.headline}\n${directive.subcopy}\n${directive.cta_text}`
          : "";

        return { imageBase64: base64, captionText };
      } catch (err: any) {
        lastError = err;
        console.error(`[${label}] attempt ${attempt} failed:`, err.message);

        if (err.message === "CREDITS_EXHAUSTED") throw err;

        if (err.message === "KIE_RATE_LIMITED") {
          const waitMs = 5000 * attempt;
          console.warn(`[${label}] rate limited, waiting ${waitMs}ms...`);
          await sleep(waitMs);
          continue;
        }

        if (attempt < 2) {
          await sleep(3000);
          continue;
        }
      }
    }
  }

  if (lastError?.message === "CREDITS_EXHAUSTED") throw lastError;
  throw new Error(lastError?.message || "All kie.ai models failed");
}

// ─────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brandId, referenceImageUrl, generationId, outputFormat = "landscape" } =
      await req.json();
    const spec = FORMAT_SPECS[outputFormat] || FORMAT_SPECS.landscape;

    // Use kie.ai API key (primary) with Lovable AI as fallback
    const KIE_KEY = Deno.env.get("KIE_API_KEY");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    const apiKey = KIE_KEY || LOVABLE_KEY;
    if (!apiKey) throw new Error("No AI API key configured (KIE_API_KEY or LOVABLE_API_KEY)");

    const usingKie = !!KIE_KEY;
    console.log(`Using AI provider: ${usingKie ? "kie.ai" : "Lovable AI (fallback)"}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Credit check ──
    let generationUserId: string | null = null;
    if (generationId) {
      const { data: genRec } = await supabase
        .from("generations")
        .select("user_id")
        .eq("id", generationId)
        .single();
      generationUserId = genRec?.user_id ?? null;
    }

    if (generationUserId) {
      const { data: creditData } = await supabase
        .from("user_credits")
        .select("credits_remaining")
        .eq("user_id", generationUserId)
        .single();

      if (creditData && creditData.credits_remaining <= 0) {
        console.log("User has no credits remaining, rejecting generation");
        await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
        return new Response(
          JSON.stringify({ error: "No credits remaining" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch brand + assets in parallel
    const [brandRes, assetsRes] = await Promise.all([
      supabase.from("brands").select("*").eq("id", brandId).single(),
      supabase.from("brand_assets").select("image_url, label").eq("brand_id", brandId),
    ]);

    if (brandRes.error || !brandRes.data) {
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brand = brandRes.data;
    const SUPPORTED_IMAGE_EXTS = /\.(png|jpe?g|webp|gif)(\?.*)?$/i;
    const brandAssets = (assetsRes.data || []).filter((a: any) => {
      if (!a.image_url) return false;
      try {
        const pathname = new URL(a.image_url).pathname;
        if (!SUPPORTED_IMAGE_EXTS.test(pathname)) {
          console.warn(`Skipping unsupported image format: ${pathname}`);
          return false;
        }
      } catch {
        if (!SUPPORTED_IMAGE_EXTS.test(a.image_url)) {
          console.warn(`Skipping unsupported image format: ${a.image_url}`);
          return false;
        }
      }
      return true;
    });

    const generationRes = generationId
      ? await supabase
          .from("generations")
          .select("status, layout_guide, copywriting, output_image_url")
          .eq("id", generationId)
          .maybeSingle()
      : { data: null, error: null };

    if (generationRes.error) {
      console.error("Failed to read existing generation state:", generationRes.error);
    }

    const existingGeneration = generationRes.data;
    const existingFramework = parseStoredFramework(existingGeneration?.layout_guide);
    const existingCaption = extractStoredCaption(existingGeneration?.copywriting);
    const existingImageUrl =
      typeof existingGeneration?.output_image_url === "string"
        ? existingGeneration.output_image_url
        : "";

    // ── Step 1: Analyze ──
    let framework: Record<string, unknown>;
    if (existingFramework) {
      framework = existingFramework;
      console.log("Reusing stored framework from previous attempt");
      await supabase.from("generations").update({ status: "generating" }).eq("id", generationId);
    } else {
      await supabase.from("generations").update({ status: "analyzing" }).eq("id", generationId);

      console.log("Step 1: Analyzing reference image framework...");
      try {
        framework = await analyzeFramework(referenceImageUrl, apiKey, spec.aspectRatio);
        console.log("Framework extracted successfully");
      } catch (err) {
        console.error("Framework analysis failed:", err);
        await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
        const isCredits = err instanceof Error && err.message === "CREDITS_EXHAUSTED";
        return new Response(
          JSON.stringify({
            error: isCredits
              ? "AI generation credits exhausted. Please contact your admin to add more credits."
              : "Failed to analyze reference image layout",
          }),
          { status: isCredits ? 402 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("generations")
        .update({
          layout_guide: JSON.stringify(framework),
          status: "adapting",
          output_format: outputFormat,
          requested_aspect_ratio: spec.aspectRatio,
          requested_width: spec.width,
          requested_height: spec.height,
        })
        .eq("id", generationId);
    }

    // ── Step 2: Adapt ──
    let directive: CreativeDirective | null = null;
    console.log("Step 2: Adapting reference concept to brand...");
    try {
      await supabase.from("generations").update({ status: "adapting" }).eq("id", generationId);
      directive = await adaptDirective(
        framework,
        brand,
        brandAssets,
        referenceImageUrl,
        spec,
        apiKey
      );
      console.log("Adapt directive created successfully");
    } catch (err) {
      console.warn("Adapt step failed, falling back to direct generation:", err);
    }

    // ── Step 3: Generate ──
    await supabase.from("generations").update({ status: "generating" }).eq("id", generationId);
    console.log("Step 3: Generating brand creative...");

    let imageBase64: string;
    let captionText: string;
    try {
      const result = await generateCreative(
        framework,
        brand,
        brandAssets,
        referenceImageUrl,
        spec,
        apiKey,
        directive
      );
      imageBase64 = result.imageBase64;
      captionText = result.captionText;
    } catch (err: any) {
      console.error("Generation failed:", err);
      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);

      if (err.message === "CREDITS_EXHAUSTED") {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up your account." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: err?.message || "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload generated image + extract actual dimensions
    let finalImageBase64 = imageBase64;
    let base64Data = finalImageBase64.replace(/^data:image\/\w+;base64,/, "");
    let imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    let actualDims = extractImageDimensions(imageBytes);
    let ratioMatch = actualDims ? isAspectRatioMatch(actualDims, spec) : null;

    if (actualDims) {
      console.log(`Actual image dimensions: ${actualDims.width}×${actualDims.height}, ratio match: ${ratioMatch}`);
    }

    // If aspect ratio is wrong, retry generation ONCE
    if (ratioMatch === false && actualDims) {
      console.warn(`⚠️ ASPECT RATIO MISMATCH: expected ${spec.aspectRatio}, got ${actualDims.width}×${actualDims.height}. Retrying...`);
      
      await supabase.from("generations").update({ status: "retrying_aspect_ratio" }).eq("id", generationId);

      try {
        const retryResult = await generateCreative(
          framework, brand, brandAssets, referenceImageUrl, spec, apiKey, directive
        );

        const retryBase64 = retryResult.imageBase64.replace(/^data:image\/\w+;base64,/, "");
        const retryBytes = Uint8Array.from(atob(retryBase64), (c) => c.charCodeAt(0));
        const retryDims = extractImageDimensions(retryBytes);
        const retryMatch = retryDims ? isAspectRatioMatch(retryDims, spec) : null;

        if (retryDims) {
          console.log(`Retry dimensions: ${retryDims.width}×${retryDims.height}, ratio match: ${retryMatch}`);
        }

        if (retryMatch !== false) {
          console.log("✅ Retry produced correct aspect ratio");
          finalImageBase64 = retryResult.imageBase64;
          base64Data = retryBase64;
          imageBytes = retryBytes;
          actualDims = retryDims;
          ratioMatch = retryMatch;
          if (retryResult.captionText) captionText = retryResult.captionText;
        } else {
          console.warn("⚠️ Retry also produced wrong aspect ratio, keeping first attempt");
        }
      } catch (retryErr) {
        console.warn("Aspect ratio retry failed, keeping first attempt:", retryErr);
      }
    }

    const outputPath = `generations/${generationId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(outputPath, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
      return new Response(
        JSON.stringify({ error: "Failed to save generated image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage.from("brand-assets").getPublicUrl(outputPath);

    const finalCaption =
      captionText ||
      (directive
        ? `${directive.headline}\n${directive.subcopy}\n${directive.cta_text}`
        : "");

    // Build copywriting JSON
    const copywritingData: Record<string, any> = { caption: finalCaption };
    if (ratioMatch === false) {
      copywritingData.aspect_ratio_mismatch = true;
      copywritingData.qc_issues = [
        `Aspect ratio mismatch: expected ${spec.aspectRatio} (${spec.width}×${spec.height}), got ${actualDims?.width}×${actualDims?.height}`
      ];
    }

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        output_image_url: publicUrlData.publicUrl,
        layout_guide: JSON.stringify(framework),
        copywriting: copywritingData,
        status: "completed",
        output_format: outputFormat,
        requested_aspect_ratio: spec.aspectRatio,
        requested_width: spec.width,
        requested_height: spec.height,
        actual_width: actualDims?.width ?? 0,
        actual_height: actualDims?.height ?? 0,
      })
      .eq("id", generationId);

    if (updateError) {
      console.error("CRITICAL: Final DB update failed!", updateError);
    }

    // ── Deduct 1 credit on success ──
    if (generationUserId) {
      const { error: creditErr } = await supabase.rpc("deduct_credit", { _user_id: generationUserId });
      if (creditErr) {
        console.error("Credit deduction failed (non-blocking):", creditErr);
      } else {
        console.log("Deducted 1 credit for user", generationUserId);
      }
    }

    return new Response(
      JSON.stringify({
        imageUrl: publicUrlData.publicUrl,
        caption: finalCaption,
        framework,
        generationId,
        outputFormat,
        requestedAspectRatio: spec.aspectRatio,
        actualDimensions: actualDims ?? undefined,
        aspectRatioMatch: ratioMatch,
        aspectRatioIssue: ratioMatch === false ? true : undefined,
        provider: usingKie ? "kie.ai" : "lovable",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-creative OUTER error:", e);

    try {
      const body = await req.clone().json().catch(() => ({}));
      const gId = body?.generationId;
      if (gId) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("generations").update({ status: "failed" }).eq("id", gId);
        console.log("Marked generation", gId, "as failed");
      }
    } catch (cleanupErr) {
      console.error("Failed to mark generation as failed:", cleanupErr);
    }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
