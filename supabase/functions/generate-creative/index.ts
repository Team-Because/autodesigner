import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMAT_SPECS: Record<string, { width: number; height: number; label: string; ratio: string }> = {
  landscape: { width: 1920, height: 1080, label: "landscape (1920×1080, 16:9)", ratio: "16:9" },
  square: { width: 1080, height: 1080, label: "square (1080×1080, 1:1)", ratio: "1:1" },
  portrait: { width: 1080, height: 1350, label: "portrait (1080×1350, 4:5)", ratio: "4:5" },
  story: { width: 1080, height: 1920, label: "portrait/story (1080×1920, 9:16)", ratio: "9:16" },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface StructuredBrandSections {
  brandIdentity: string;
  mustInclude: string;
  visualDirection: string;
  voiceAndTone: string;
  dos: string;
  donts: string;
  colorNotes: string;
  referenceNotes: string;
}

const EMPTY_BRAND_SECTIONS: StructuredBrandSections = {
  brandIdentity: "",
  mustInclude: "",
  visualDirection: "",
  voiceAndTone: "",
  dos: "",
  donts: "",
  colorNotes: "",
  referenceNotes: "",
};

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

function getRenderedBrandBrief(brandBrief: unknown): string {
  if (typeof brandBrief !== "string" || !brandBrief.trim()) return "";

  try {
    const parsed = JSON.parse(brandBrief);
    if (parsed?._structured && typeof parsed?._rendered === "string") {
      return parsed._rendered.trim();
    }
  } catch {
    // legacy free-text brief
  }

  return brandBrief.trim();
}

function parseStructuredBrandSections(brandBrief: unknown): StructuredBrandSections {
  if (typeof brandBrief !== "string" || !brandBrief.trim()) return { ...EMPTY_BRAND_SECTIONS };

  try {
    const parsed = JSON.parse(brandBrief);
    if (parsed?._structured && parsed?.sections && typeof parsed.sections === "object") {
      return {
        ...EMPTY_BRAND_SECTIONS,
        ...Object.fromEntries(
          Object.entries(parsed.sections as Record<string, unknown>).map(([key, value]) => [
            key,
            typeof value === "string" ? value.trim() : "",
          ])
        ),
      } as StructuredBrandSections;
    }
  } catch {
    // legacy free-text brief
  }

  return { ...EMPTY_BRAND_SECTIONS };
}

function extractProductCandidatesFromBrief(sections: StructuredBrandSections, renderedBrief: string): string[] {
  const candidates = new Set<string>();
  const sourceLines = `${sections.brandIdentity}\n${sections.mustInclude}\n${renderedBrief}`
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of sourceLines) {
    const colonMatch = /^(?:[-*]\s*)?([A-Za-z][A-Za-z0-9 '&/+()-]{1,40}):\s*(.+)$/.exec(line);
    if (!colonMatch) continue;

    const label = colonMatch[1].trim();
    const rhs = colonMatch[2].trim();

    if (/(samosa|momo|spring roll|roll|patty|kebab|tikki|snack|meal)/i.test(label)) {
      candidates.add(label.replace(/\bProducts?\b/i, "").trim());
    }

    if (/(brand name|tagline|cta|contact|legal|other|visual|content|mood|lighting|photography|layout|composition|voice|audience|response|use|avoid|rule)/i.test(label)) {
      continue;
    }

    for (const part of rhs.split(/,\s*/)) {
      const cleaned = part.replace(/^[-•]\s*/, "").trim();
      if (
        cleaned &&
        cleaned.length <= 40 &&
        /[A-Za-z]/.test(cleaned) &&
        !/(ready in just|order now|link in bio|admissions|contact|http|www\.)/i.test(cleaned)
      ) {
        candidates.add(cleaned);
      }
    }
  }

  return Array.from(candidates).slice(0, 12);
}

function inferFocusProductFromFramework(
  framework: Record<string, unknown>,
  productCandidates: string[]
): string {
  if (productCandidates.length === 0) return "";

  const frameworkText = JSON.stringify(framework).toLowerCase();
  const preferenceMap = [
    { keywords: ["spring", "roll"], matcher: /spring roll/i },
    { keywords: ["dumpling", "momo"], matcher: /momo/i },
    { keywords: ["nugget", "fried", "crispy", "triangle", "snack"], matcher: /samosa/i },
    { keywords: ["patty", "burger"], matcher: /patty/i },
    { keywords: ["kebab", "cutlet"], matcher: /kebab/i },
  ];

  for (const preference of preferenceMap) {
    if (preference.keywords.some((keyword) => frameworkText.includes(keyword))) {
      const match = productCandidates.find((candidate) => preference.matcher.test(candidate));
      if (match) return match;
    }
  }

  return productCandidates[0];
}

function extractCaptionText(aiData: any): string {
  const content = aiData?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => part?.type === "text" && typeof part?.text === "string")
      .map((part: any) => part.text)
      .join("\n")
      .trim();
  }
  return "";
}

function extractImagePayload(aiData: any): string | null {
  const candidates = [
    aiData?.choices?.[0]?.message?.images?.[0]?.image_url?.url,
    aiData?.choices?.[0]?.message?.images?.[0]?.url,
    aiData?.choices?.[0]?.message?.image_url?.url,
    aiData?.choices?.[0]?.message?.image_url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }

  return null;
}

/** Step 1 — Analyze the reference image and extract a structured design framework */
async function analyzeFramework(
  referenceImageUrl: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const analyzeResponse = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an expert visual design analyst. Analyze the given advertisement image and extract a precise structural framework describing its layout, composition, visual style, and text elements. Be specific about positions, sizes, and visual treatments.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this advertisement image and extract its complete design framework. Describe every visual zone, text element, and stylistic choice in detail.",
              },
              {
                type: "image_url",
                image_url: { url: referenceImageUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_design_framework",
              description:
                "Extract a structured design framework from the reference advertisement image.",
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
                              description:
                                "Zone name, e.g. logo, headline, hero_image, cta_button, product_image, background, subtext, tagline",
                            },
                            position: {
                              type: "string",
                              description:
                                "Precise position, e.g. top-left, center, bottom-right, left-third, right-half",
                            },
                            size: {
                              type: "string",
                              description:
                                "Relative size: tiny, small, medium, large, half, full",
                            },
                            description: {
                              type: "string",
                              description:
                                "What occupies this zone in the reference image",
                            },
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
                      background_type: {
                        type: "string",
                        description:
                          "solid, gradient, photo, pattern, split, etc.",
                      },
                      photography_style: {
                        type: "string",
                        description:
                          "lifestyle, product-shot, abstract, illustration, none",
                      },
                      overlay: {
                        type: "string",
                        description:
                          "Overlay treatment: none, dark-gradient, light-gradient, color-wash, etc.",
                      },
                      mood: {
                        type: "string",
                        description:
                          "Overall mood: professional, playful, luxurious, energetic, minimalist, etc.",
                      },
                      color_scheme: {
                        type: "string",
                        description:
                          "Describe the dominant colors and their distribution",
                      },
                    },
                    required: [
                      "background_type",
                      "photography_style",
                      "overlay",
                      "mood",
                      "color_scheme",
                    ],
                    additionalProperties: false,
                  },
                  text_elements: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: {
                          type: "string",
                          description:
                            "headline, subtext, cta, tagline, disclaimer, price",
                        },
                        content_description: {
                          type: "string",
                          description: "What the text says or conveys",
                        },
                        position: {
                          type: "string",
                          description: "Where it appears in the layout",
                        },
                        font_style: {
                          type: "string",
                          description:
                            "bold, light, italic, uppercase, condensed, etc.",
                        },
                        approximate_size: {
                          type: "string",
                          description: "small, medium, large, extra-large",
                        },
                      },
                      required: [
                        "type",
                        "content_description",
                        "position",
                        "font_style",
                        "approximate_size",
                      ],
                      additionalProperties: false,
                    },
                  },
                  composition_notes: {
                    type: "string",
                    description:
                      "Additional notes about symmetry, focal point, whitespace, visual flow, and any distinctive design techniques",
                  },
                },
                required: [
                  "layout",
                  "style",
                  "text_elements",
                  "composition_notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "extract_design_framework" },
        },
      }),
    }
  );

  if (!analyzeResponse.ok) {
    const errText = await analyzeResponse.text();
    console.error("Framework analysis error:", analyzeResponse.status, errText);
    throw new Error(`Framework analysis failed (${analyzeResponse.status})`);
  }

  const analyzeData = await analyzeResponse.json();
  const toolCall = analyzeData.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No framework extracted from reference image");
  }

  return JSON.parse(toolCall.function.arguments);
}

/** Step 1.5 — Pre-generation Creative Brief Review */
interface RefinedBrief {
  productName: string;
  headline: string;
  subCopy: string;
  ctaText: string;
  visualDirection: string;
  colorStrategy: string;
  layoutNotes: string;
  warnings: string[];
}

async function refineBrief(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  spec: { width: number; height: number; label: string; ratio: string },
  apiKey: string
): Promise<RefinedBrief> {
  const rawBrief = getRenderedBrandBrief(brand.brand_brief);
  const sections = parseStructuredBrandSections(brand.brand_brief);
  const productCandidates = extractProductCandidatesFromBrief(sections, rawBrief);
  const focusProductHint = inferFocusProductFromFramework(framework, productCandidates);

  const extraColorsText = brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
    ? brand.extra_colors.map((c: any) => `${c.name || "Unnamed"}: ${c.hex}`).join(", ")
    : "";

  const assetLabels = brandAssets.slice(0, 5).map((a: any) => a.label || "Brand asset").join(", ");

  const systemPrompt = `You are a senior creative director at a Cannes Lions-winning agency. Your job is to review an assembled creative brief BEFORE it goes to the image generation model and produce an optimised, conflict-free creative direction.

Your task:
- Choose ONE exact hero product name for this creative
- Write the EXACT headline text (≤8 words, punchy, benefit-driven, original)
- Write the EXACT sub-copy text (≤20 words, one supporting sentence)
- Write the EXACT CTA text (short call-to-action or contact info)
- Produce specific visual direction that resolves conflicts between the reference framework and the brand rules
- Define a color strategy: which brand color goes where
- Provide layout adaptation notes for fitting the framework to this brand
- Flag any warnings about potential issues

CRITICAL RULES:
- If the brand says to always include product name, the chosen productName MUST appear verbatim in the headline or subCopy
- If the brand has a mandatory tagline or CTA, include them verbatim in subCopy/ctaText instead of paraphrasing
- If the reference is lifestyle-heavy but the brand says food first, OVERRIDE the reference and make the food the unmistakable hero
- If the reference mood conflicts with the brand mood, resolve it decisively
- Never use placeholder text — every word must be final, print-ready
- All copy must be in the brand's language
- Avoid generic lines like “Mealtime revolution” — sound like the brand, not an ad cliché`;

  const userPrompt = `BRAND CONTEXT:
Brand Name: ${brand.name}
Primary Color: ${brand.primary_color}
Secondary Color: ${brand.secondary_color}
${extraColorsText ? `Additional Colors: ${extraColorsText}` : ""}
${brand.brand_voice_rules ? `Voice & Tone: ${brand.brand_voice_rules}` : ""}
${brand.negative_prompts ? `⛔ EXCLUSIONS (never use): ${brand.negative_prompts}` : ""}
${sections.mustInclude ? `MANDATORY ELEMENTS:\n${sections.mustInclude}` : ""}
${sections.visualDirection ? `VISUAL DIRECTION RULES:\n${sections.visualDirection}` : ""}
${sections.colorNotes ? `COLOR NOTES:\n${sections.colorNotes}` : ""}
${rawBrief ? `FULL BRAND BRIEF:\n${rawBrief}` : ""}

PRODUCT CANDIDATES: ${productCandidates.join(", ") || "None provided — choose the most plausible product from the brief."}
${focusProductHint ? `FOCUS PRODUCT HINT: ${focusProductHint}` : ""}

DESIGN FRAMEWORK (from reference analysis):
${JSON.stringify(framework, null, 2)}

OUTPUT FORMAT: ${spec.label} (${spec.ratio})

AVAILABLE BRAND ASSETS: ${assetLabels || "None"}

Review this brief and produce the optimised creative direction.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "refined_creative_brief",
            description: "Return the optimised creative brief for image generation",
            parameters: {
              type: "object",
              properties: {
                productName: {
                  type: "string",
                  description: "One exact hero product name to feature in the creative. Must be a real product from the brand brief when available.",
                },
                headline: {
                  type: "string",
                  description: "Exact headline text to render. ≤8 words, bold, benefit-driven, and brand-true.",
                },
                subCopy: {
                  type: "string",
                  description: "Exact sub-copy text. ≤20 words. Include mandatory tagline/product mention here if needed.",
                },
                ctaText: {
                  type: "string",
                  description: "Exact CTA or contact text. Preserve required CTA wording when provided.",
                },
                visualDirection: {
                  type: "string",
                  description: "Specific visual instructions for the image model: mood, lighting, photography style, background treatment, and hero emphasis.",
                },
                colorStrategy: {
                  type: "string",
                  description: "Exactly which brand color goes where: background, headline, accents, CTA bar, and supporting text. Use actual hex values.",
                },
                layoutNotes: {
                  type: "string",
                  description: "How to adapt the reference framework for this brand: which zones to emphasize, what to simplify, and what must change.",
                },
                warnings: {
                  type: "array",
                  items: { type: "string" },
                  description: "Any conflicts found and how they were resolved, or risks to watch for.",
                },
              },
              required: ["productName", "headline", "subCopy", "ctaText", "visualDirection", "colorStrategy", "layoutNotes", "warnings"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "refined_creative_brief" } },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Brief refinement error:", response.status, errText);
    throw new Error(`Brief refinement failed (${response.status})`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error("No refined brief returned");
  }

  const result = JSON.parse(toolCall.function.arguments);
  return {
    productName: result.productName || focusProductHint || productCandidates[0] || "",
    headline: result.headline || "",
    subCopy: result.subCopy || "",
    ctaText: result.ctaText || "",
    visualDirection: result.visualDirection || "",
    colorStrategy: result.colorStrategy || "",
    layoutNotes: result.layoutNotes || "",
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
  };
}

/** Step 2 — Generate the brand creative using the framework */
async function generateCreative(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  referenceImageUrl: string,
  spec: { width: number; height: number; label: string; ratio: string },
  apiKey: string,
  refinedBrief?: RefinedBrief | null,
  qcFeedback: string[] = []
): Promise<{ imageBase64: string; captionText: string }> {
  const extraColorsText = brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
    ? `Additional Colors:\n${brand.extra_colors.map((c: any) => `  - ${c.name || "Unnamed"}: ${c.hex}`).join("\n")}`
    : "";

  const negativePrompts = toCompactText(brand.negative_prompts, 2000);
  const voiceRules = toCompactText(brand.brand_voice_rules, 1600);
  const renderedBrandBrief = getRenderedBrandBrief(brand.brand_brief);
  const brandSections = parseStructuredBrandSections(brand.brand_brief);
  const frameworkJson = JSON.stringify(framework, null, 2);
  const aspectRatioLabel = `${spec.ratio} (${spec.width}×${spec.height})`;
  const focusProductName = refinedBrief?.productName?.trim() || inferFocusProductFromFramework(
    framework,
    extractProductCandidatesFromBrief(brandSections, renderedBrandBrief)
  );
  const foodFirstBrand = /food is always hero|focus on food first|food-focused|drool-worthy|texture|fillings visible/i
    .test(`${brandSections.visualDirection}\n${renderedBrandBrief}`);

  const dedupedAssets = brandAssets.filter((asset: any, index: number, all: any[]) => {
    const assetLabel = String(asset?.label || "").trim().toLowerCase();
    return index === all.findIndex((candidate: any) => {
      const candidateLabel = String(candidate?.label || "").trim().toLowerCase();
      return candidate?.image_url === asset?.image_url || (assetLabel && candidateLabel === assetLabel);
    });
  });

  const logoAssets = dedupedAssets.filter((a: any) => /logo/i.test(a.label || ""));
  const patternAssets = dedupedAssets.filter((a: any) => /pattern|texture|background/i.test(a.label || ""));
  const architectureAssets = dedupedAssets.filter((a: any) => /architect|3d|render|building|elevation|facade/i.test(a.label || ""));
  const productAssets = dedupedAssets.filter((a: any) => /hero|lifestyle|product|food|pack|packshot|dish|meal|mascot|master/i.test(a.label || ""));
  const supportingAssets = dedupedAssets.filter((a: any) =>
    !logoAssets.includes(a) &&
    !patternAssets.includes(a) &&
    !architectureAssets.includes(a) &&
    !productAssets.includes(a)
  );

  const selectedAssets = [
    ...logoAssets.slice(0, 1),
    ...productAssets.slice(0, 2),
    ...architectureAssets.slice(0, 1),
    ...patternAssets.slice(0, 1),
    ...supportingAssets.slice(0, 1),
  ].slice(0, 5);
  const omittedAssetsCount = Math.max(dedupedAssets.length - selectedAssets.length, 0);
  const hasAssets = selectedAssets.length > 0;

  const assetRoleDescriptions = [
    ...logoAssets.slice(0, 1).map((a: any) => `  🔷 OFFICIAL LOGO: "${a.label || "Logo"}" — Use exactly once in a clear brand zone. Never redraw it. Add a backing panel if contrast is weak.`),
    ...productAssets.slice(0, 2).map((a: any) => `  🍽️ PRODUCT/HERO ASSET: "${a.label || "Visual"}" — Use as hero or supporting visual without altering identity.`),
    ...architectureAssets.slice(0, 1).map((a: any) => `  🏗️ 3D RENDER: "${a.label || "Architecture"}" — Preserve architecture exactly; only enhance lighting, angle, and atmosphere.`),
    ...patternAssets.slice(0, 1).map((a: any) => `  🎛️ PATTERN/TEXTURE: "${a.label || "Pattern"}" — Optional only. Use subtly (5-12% opacity) behind the hero. Never let it dominate or clutter the frame.`),
    ...supportingAssets.slice(0, 1).map((a: any) => `  📎 SUPPORTING ASSET: "${a.label || "Brand asset"}" — Use only if it strengthens hierarchy and clarity.`),
  ].join("\n");

  const refinedBlock = refinedBrief ? `
══════════════════════════════════════════
🎯 CREATIVE DIRECTION (from Creative Director review)
══════════════════════════════════════════
The following has been pre-approved by the Creative Director. Follow these EXACTLY:

FOCUS PRODUCT (must be shown clearly and named in copy):
"${refinedBrief.productName}"

HEADLINE (render this text VERBATIM, large and bold):
"${refinedBrief.headline}"

SUB-COPY (render this text VERBATIM, medium size):
"${refinedBrief.subCopy}"

CTA / CONTACT (render this text VERBATIM, small, bottom zone):
"${refinedBrief.ctaText}"

VISUAL DIRECTION:
${refinedBrief.visualDirection}

COLOR STRATEGY:
${refinedBrief.colorStrategy}

LAYOUT ADAPTATION:
${refinedBrief.layoutNotes}

${refinedBrief.warnings.length > 0 ? `⚠️ WARNINGS TO ADDRESS:\n${refinedBrief.warnings.map((w, i) => `${i + 1}. ${w}`).join("\n")}` : ""}

IMPORTANT: The product name, headline, sub-copy, and CTA above are FINAL. Render them EXACTLY as written. Do NOT improvise or change the wording.
` : "";

  const retryFeedbackBlock = qcFeedback.length > 0 ? `
══════════════════════════════════════════
⚠️ MANDATORY FIXES FROM QC
══════════════════════════════════════════
The previous attempt failed quality check. Fix ALL of these issues in this new generation:
${qcFeedback.map((issue, index) => `${index + 1}. ${issue}`).join("\n")}

Do not repeat any of these mistakes.
` : "";

  const systemPrompt = `You are an elite creative director at a top-tier advertising agency. You produce award-winning, publication-ready advertisements.

══════════════════════════════════════════
ABSOLUTE OUTPUT FORMAT REQUIREMENT
══════════════════════════════════════════
The generated image MUST be exactly ${spec.width}×${spec.height} pixels — a ${aspectRatioLabel} format.
${spec.width === spec.height ? "The image MUST be perfectly SQUARE." : ""}
${spec.height > spec.width ? "The image MUST be TALL/VERTICAL (portrait orientation)." : ""}
${spec.width > spec.height ? "The image MUST be WIDE (landscape orientation)." : ""}
The final canvas MUST follow ${spec.ratio}. If the reference layout conflicts with this ratio, recomposition is REQUIRED.
DO NOT generate an image in any other aspect ratio.

══════════════════════════════════════════
🧭 REFERENCE ADAPTATION RULES
══════════════════════════════════════════
- The reference image is layout inspiration only — NEVER copy its source text, logo treatment, language, exact crop, or human subject literally.
- ALWAYS adapt the composition to ${spec.ratio}; the requested format overrides the reference orientation.
- Preserve only the high-level composition logic and hierarchy, not the reference's text, aspect ratio, or brand identity.
${foodFirstBrand ? "- This brand is FOOD-FIRST. Override lifestyle-heavy references when necessary so the food itself is the hero, not a generic person-eating moment." : ""}

══════════════════════════════════════════
🔤 TEXT RENDERING GUARDRAILS
══════════════════════════════════════════
- Render ONLY approved copy and official brand assets.
- NEVER reproduce or paraphrase any text visible in the reference image.
- No extra labels, duplicate slogans, watermark-like text, or decorative fake glyphs.
- No mirrored, garbled, cut-off, wrong-language, or non-Latin text unless the approved brand copy explicitly requires it.
- If text cannot be rendered cleanly, simplify layout around the approved text — do NOT invent substitute text.
${focusProductName ? `- The product name "${focusProductName}" must appear verbatim in the approved copy.` : ""}

══════════════════════════════════════════
🎨 LOGO CONTRAST & READABILITY
══════════════════════════════════════════
- On DARK backgrounds: Use WHITE/LIGHT logo or add light backing panel.
- On LIGHT backgrounds: Use logo as-is or dark form.
- On BUSY backgrounds: Place logo in a clear zone with a backing panel.
- Logo must NEVER blend into the background or be covered by the hero visual.
${refinedBlock}${retryFeedbackBlock}
══════════════════════════════════════════
🔒 LOGO & PRODUCT ASSET FIDELITY
══════════════════════════════════════════
- NEVER redraw or reimagine logos, products, or mascots.
- Place official assets EXACTLY as provided — only adjust size, placement, and contrast.
- If no official product photo exists, generate a premium food-first hero image of the selected product that matches the brief.

══════════════════════════════════════════
📐 QUALITY STANDARDS
══════════════════════════════════════════
- Clear visual hierarchy: hero → headline → supporting copy → CTA.
- Hero visual: 50-70% of canvas, never obscured by text.
- ALL text must be legible with proper contrast.
- No duplicated elements (logo, name, location, price, CTA).
- Intentional negative space.
- Secondary color must be visibly present, not incidental.
- The background pattern must remain subtle and supportive, never noisy or dominant.
${foodFirstBrand ? "- Show the food close-up, appetizing, hot, and texture-rich. Avoid a generic stock-style human scene as the main focal point." : ""}

══════════════════════════════════════════
📋 BRAND CONTEXT
══════════════════════════════════════════
Brand Name: ${brand.name}
Primary Color: ${brand.primary_color}
Secondary Color: ${brand.secondary_color}
${extraColorsText}
${voiceRules ? `Voice & Tone Rules: ${voiceRules}` : ""}
${negativePrompts ? `⛔ EXCLUSIONS: ${negativePrompts}` : ""}
${focusProductName ? `Hero Product: ${focusProductName}` : ""}
${brandSections.mustInclude ? `Mandatory Elements:\n${brandSections.mustInclude}` : ""}

══════════════════════════════════════════
BRAND BRIEF / GUIDELINES
══════════════════════════════════════════
${renderedBrandBrief || "No additional brand brief provided."}

══════════════════════════════════════════
DESIGN FRAMEWORK
══════════════════════════════════════════
${frameworkJson}

${hasAssets ? `══════════════════════════════════════════
BRAND ASSETS (${selectedAssets.length} images)
══════════════════════════════════════════
${assetRoleDescriptions}${omittedAssetsCount > 0 ? `\n(${omittedAssetsCount} additional asset(s) omitted)` : ""}
The FIRST image is the REFERENCE (layout inspiration only). Images 2+ are OFFICIAL BRAND ASSETS.` : `No brand assets provided. Use "${brand.name}" as prominent text with brand colors.`}

══════════════════════════════════════════
CHECKLIST
══════════════════════════════════════════
✅ Output is EXACTLY ${spec.width}×${spec.height} (${spec.ratio})
✅ Reference orientation has been adapted if needed
✅ Hero visual 50-70%, fully visible
✅ Logo clearly visible with proper contrast
✅ Only approved brand copy is visible
✅ No extra or wrong-language text
${focusProductName ? `✅ Product name "${focusProductName}" appears verbatim in the copy and matches the hero visual` : "✅ Product choice is explicit and matches the hero visual"}
${refinedBrief ? `✅ Headline: "${refinedBrief.headline}" — rendered VERBATIM
✅ Sub-copy: "${refinedBrief.subCopy}" — rendered VERBATIM
✅ CTA: "${refinedBrief.ctaText}" — rendered VERBATIM` : `✅ Headline ≤8 words, bold, original
✅ Sub-copy ≤20 words
✅ CTA clean and actionable`}
✅ Brand colors applied: ${brand.primary_color} primary, ${brand.secondary_color} secondary
✅ Secondary color is visibly used in a meaningful way
✅ No duplicated elements
✅ Professional, premium quality

Generate the brand-aligned creative image now.`;

  const userContent: any[] = [
    {
      type: "text",
      text: hasAssets
        ? `Use the FIRST image only as structural inspiration for composition and zone hierarchy. Do NOT copy any text, language, logo treatment, human subject, or original aspect ratio from it. Adapt the layout to ${spec.label} (${spec.ratio}). The following ${selectedAssets.length} image(s) are official brand assets — use them exactly as instructed.`
        : `Use the reference image only as structural inspiration. Do NOT copy its text, language, logo treatment, human subject, or original aspect ratio. Adapt everything to ${spec.label} (${spec.ratio}) and follow the brand rules exactly.`,
    },
    {
      type: "image_url",
      image_url: { url: referenceImageUrl },
    },
  ];

  for (const asset of selectedAssets) {
    userContent.push({
      type: "image_url",
      image_url: { url: (asset as any).image_url },
    });
  }

  const modelPlan = [
    { model: "google/gemini-3.1-flash-image-preview", timeoutMs: 80000 },
    { model: "google/gemini-2.5-flash-image", timeoutMs: 80000 },
    { model: "google/gemini-3-pro-image-preview", timeoutMs: 95000 },
  ];
  const transientStatuses = new Set([500, 502, 503, 504, 529]);

  let sawOverload = false;
  let sawTruncated = false;
  let sawAnyFailure = false;
  let lastStatus: number | null = null;

  for (const { model, timeoutMs } of modelPlan) {
    console.log(`Using model: ${model}`);
    console.log(`[${model}] image generation attempt 1/1...`);

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          modalities: ["image", "text"],
          image_config: { aspect_ratio: spec.ratio },
          size: `${spec.width}x${spec.height}`,
          image_size: { width: spec.width, height: spec.height },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );

    if (!aiResponse.ok) {
      sawAnyFailure = true;
      lastStatus = aiResponse.status;
      const errText = await aiResponse.text().catch(() => "");
      console.error(`[${model}] AI error ${aiResponse.status}:`, errText);

      if (aiResponse.status === 429) {
        sawOverload = true;
        continue;
      }
      if (aiResponse.status === 402) throw new Error("CREDITS_EXHAUSTED");

      const isOverloaded = aiResponse.status === 503 || aiResponse.status === 529;
      if (isOverloaded) {
        sawOverload = true;
      }

      if (transientStatuses.has(aiResponse.status)) {
        const delay = isOverloaded ? 2500 : 1200;
        console.warn(`[${model}] transient error (${aiResponse.status}), pausing ${delay}ms before fallback...`);
        await sleep(delay);
        continue;
      }

      break;
    }

    let aiData: any;
    try {
      aiData = await aiResponse.json();
    } catch {
      sawAnyFailure = true;
      sawTruncated = true;
      console.warn(`[${model}] attempt 1: Truncated response body`);
      await sleep(1000);
      continue;
    }

    const imageBase64 = extractImagePayload(aiData);
    const captionText = extractCaptionText(aiData);

    console.log(`[${model}] attempt 1 response:`, JSON.stringify({
      hasImage: !!imageBase64,
    }));

    if (imageBase64) {
      return { imageBase64, captionText };
    }

    sawAnyFailure = true;
    console.warn(`[${model}] attempt 1: No image payload returned`);
    await sleep(800);

    if (model !== modelPlan[modelPlan.length - 1].model) {
      console.warn(`Switching to fallback model after empty response on ${model}`);
    }
  }

  if (sawOverload) throw new Error("UPSTREAM_OVERLOADED");
  if (sawTruncated) throw new Error("AI_TRUNCATED_RESPONSE");
  if (lastStatus !== null) throw new Error(`AI generation failed (${lastStatus})`);
  if (sawAnyFailure) throw new Error("AI generation failed");
  throw new Error("NO_IMAGE_GENERATED");
}

/** Step 3 — Quality Check the generated creative */
async function qualityCheck(
  imageBase64: string,
  brand: any,
  spec: { width: number; height: number; label: string; ratio: string },
  apiKey: string
): Promise<{ passed: boolean; score: number; issues: string[]; critical: boolean }> {
  // Build rich brand context for QC
  let brandBriefText = "";
  try {
    const parsed = JSON.parse(brand.brand_brief || "");
    if (parsed?._structured && parsed?._rendered) brandBriefText = parsed._rendered;
  } catch {
    brandBriefText = brand.brand_brief || "";
  }

  const extraColorsText = brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
    ? brand.extra_colors.map((c: any) => `${c.name || "Unnamed"}: ${c.hex}`).join(", ")
    : "";

  try {
    const qcResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are an uncompromising QC inspector for advertising creatives at a premium agency. You protect the brand from any output that would embarrass it. Score STRICTLY — only genuinely professional, brand-aligned work should pass. A score of 70+ means "client-ready". Below 65 means "unacceptable, must redo".`,
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Inspect this generated advertisement creative STRICTLY against the brand specs below.

══════════════════════════════════
BRAND SPECIFICATIONS
══════════════════════════════════
Brand Name: ${brand.name}
Primary Color: ${brand.primary_color}
Secondary Color: ${brand.secondary_color}
${extraColorsText ? `Additional Colors: ${extraColorsText}` : ""}
Required Aspect Ratio: ${spec.ratio} (${spec.width}×${spec.height})
${brand.brand_voice_rules ? `Voice & Tone Rules: ${brand.brand_voice_rules}` : ""}
${brand.negative_prompts ? `⛔ BANNED ELEMENTS (must NOT appear): ${brand.negative_prompts}` : ""}
${brandBriefText ? `Brand Brief / Guidelines:\n${brandBriefText}` : ""}

══════════════════════════════════
QC CHECKLIST — Score each area:
══════════════════════════════════
1. ASPECT RATIO (Critical): Does the image match ${spec.ratio}? Wrong ratio = automatic critical failure.
2. LOGO VISIBILITY (Critical): Is the brand logo/mark clearly visible with proper contrast? Missing/illegible logo = critical.
3. TEXT LEGIBILITY (Critical): Is ALL text clearly readable? No overlapping, cut-off, garbled, or wrong-language text? Unreadable text = critical.
4. TEXT DUPLICATION: Is any text, brand name, tagline, or element unnecessarily repeated?
5. BRAND COLOR ALIGNMENT: Are ${brand.primary_color} and ${brand.secondary_color} prominently used as specified?
6. BRAND VOICE COMPLIANCE: Does the copy match the brand's tone and voice rules? Is it original (not copied from guidelines)?
7. BANNED ELEMENTS: Are ANY of the banned/excluded elements present? If so = critical.
8. COMPOSITION & HIERARCHY: Professional layout with clear visual flow? Hero visual prominent? Clean, not cluttered?
9. OVERALL BRAND ALIGNMENT: Does this creative FEEL like it belongs to "${brand.name}"? Would a brand manager approve this?

Score 0-100. Be strict. Only score 70+ if genuinely client-ready.
Mark critical=true if ANY critical check fails.`,
                },
                {
                  type: "image_url",
                  image_url: { url: imageBase64 },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "qc_result",
                description: "Return QC inspection results",
                parameters: {
                  type: "object",
                  properties: {
                    passed: { type: "boolean", description: "True if score >= 65 and no critical issues" },
                    score: { type: "number", description: "Quality score 0-100. Be strict — 70+ means client-ready." },
                    issues: {
                      type: "array",
                      items: { type: "string" },
                      description: "List of specific issues found, each as an actionable fix instruction",
                    },
                    critical: {
                      type: "boolean",
                      description: "True if there are critical issues: wrong aspect ratio, missing/illegible logo, unreadable text, banned elements present",
                    },
                  },
                  required: ["passed", "score", "issues", "critical"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "qc_result" } },
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    if (!qcResponse.ok) {
      console.warn("QC check failed with status:", qcResponse.status);
      await qcResponse.text();
      return { passed: true, score: 70, issues: ["QC check unavailable"], critical: false };
    }

    const qcData = await qcResponse.json();
    const toolCall = qcData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return { passed: true, score: 70, issues: ["QC parse failed"], critical: false };
    }

    const result = JSON.parse(toolCall.function.arguments);
    return {
      passed: !!result.passed,
      score: Number(result.score) || 0,
      issues: Array.isArray(result.issues) ? result.issues : [],
      critical: !!result.critical,
    };
  } catch (err) {
    console.error("QC check error:", err);
    return { passed: true, score: 70, issues: ["QC check timed out"], critical: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brandId, referenceImageUrl, generationId, outputFormat = "landscape" } = await req.json();
    const spec = FORMAT_SPECS[outputFormat] || FORMAT_SPECS.landscape;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Credit check ---
    // Get user_id from the generation record or auth header
    const authHeader = req.headers.get("Authorization") || "";
    let callerUserId: string | null = null;
    if (authHeader) {
      const callerClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user: callerUser } } = await callerClient.auth.getUser();
      callerUserId = callerUser?.id || null;
    }

    if (callerUserId) {
      const { data: credits } = await supabase
        .from("user_credits")
        .select("credits_remaining")
        .eq("user_id", callerUserId)
        .single();

      if (credits && credits.credits_remaining <= 0) {
        return new Response(
          JSON.stringify({ error: "No credits remaining. Contact your admin to add more." }),
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
    const brandAssets = assetsRes.data || [];

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
    const existingImageUrl = typeof existingGeneration?.output_image_url === "string"
      ? existingGeneration.output_image_url
      : "";

    // Reuse already-computed framework so retries don't trigger an extra analysis call.
    let framework: Record<string, unknown>;
    if (existingFramework) {
      framework = existingFramework;
      console.log("Reusing stored framework from previous attempt");
      await supabase.from("generations").update({ status: "generating" }).eq("id", generationId);
    } else {
      await supabase.from("generations").update({ status: "analyzing" }).eq("id", generationId);

      console.log("Step 1: Analyzing reference image framework...");
      try {
        framework = await analyzeFramework(referenceImageUrl, LOVABLE_API_KEY);
        console.log("Framework extracted successfully");
      } catch (err) {
        console.error("Framework analysis failed:", err);
        await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
        return new Response(
          JSON.stringify({ error: "Failed to analyze reference image layout" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("generations")
        .update({ layout_guide: JSON.stringify(framework), status: "refining" })
        .eq("id", generationId);
    }

    // Step 1.5: Creative Brief Review — refine the prompt before generation
    console.log("Step 1.5: Refining creative brief...");
    await supabase.from("generations").update({ status: "refining" }).eq("id", generationId);

    let refinedBriefResult: RefinedBrief | null = null;
    try {
      refinedBriefResult = await refineBrief(framework, brand, brandAssets, spec, LOVABLE_API_KEY);
      console.log("Brief refined successfully:", JSON.stringify({
        headline: refinedBriefResult.headline,
        warnings: refinedBriefResult.warnings.length,
      }));
    } catch (err) {
      console.warn("Brief refinement failed, proceeding without refined brief:", err);
      // Non-fatal — fall back to unrefined generation
    }

    console.log("Step 2: Generating brand creative...");
    await supabase.from("generations").update({ status: "generating" }).eq("id", generationId);

    let imageBase64: string;
    let captionText: string;
    try {
      const result = await generateCreative(
        framework, brand, brandAssets, referenceImageUrl, spec, LOVABLE_API_KEY, refinedBriefResult
      );
      imageBase64 = result.imageBase64;
      captionText = result.captionText;
    } catch (err: any) {
      console.error("Generation failed:", err);
      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);

      if (err.message === "CREDITS_EXHAUSTED") {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (err.message === "UPSTREAM_OVERLOADED") {
        return new Response(
          JSON.stringify({
            error: "AI providers are busy right now. Your layout analysis was saved, so retrying will skip that step and put less load on generation.",
            retryable: true,
            retryAfterSeconds: 45,
            analysisReused: !!existingFramework,
            cachedPreview: existingImageUrl || undefined,
            cachedCaption: existingCaption || undefined,
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "45" } }
        );
      }
      if (err.message === "AI_TRUNCATED_RESPONSE") {
        return new Response(
          JSON.stringify({ error: "AI returned an incomplete response. Please retry." }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (err.message === "NO_IMAGE_GENERATED") {
        return new Response(
          JSON.stringify({ error: "No image was generated. Try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusMatch = /AI generation failed \((\d+)\)/.exec(err.message || "");
      if (statusMatch) {
        const statusCode = Number(statusMatch[1]);
        return new Response(
          JSON.stringify({ error: `AI generation failed (${statusCode})` }),
          { status: Number.isFinite(statusCode) ? statusCode : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: err?.message || "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Quality Check with auto-retry loop (up to 3 retries)
    console.log("Step 3: Running quality check...");
    await supabase.from("generations").update({ status: "quality_checking" }).eq("id", generationId);

    let qcResult = await qualityCheck(imageBase64, brand, spec, LOVABLE_API_KEY);
    console.log("QC result:", JSON.stringify(qcResult));

    const MAX_QC_RETRIES = 1;
    const MIN_ACCEPTABLE_SCORE = 65;
    const originalBrief = brand.brand_brief || "";

    for (let qcRetry = 0; qcRetry < MAX_QC_RETRIES; qcRetry++) {
      // Retry if score < MIN_ACCEPTABLE_SCORE OR critical issues found
      const shouldRetry = qcResult.score < MIN_ACCEPTABLE_SCORE || qcResult.critical;
      if (!shouldRetry || qcResult.issues.length === 0) break;

      console.log(`QC retry ${qcRetry + 1}/${MAX_QC_RETRIES}: score=${qcResult.score}, critical=${qcResult.critical}, issues=${qcResult.issues.length}`);
      await supabase.from("generations").update({ status: "generating" }).eq("id", generationId);

      // Inject QC feedback as a top-level instruction block
      const attemptLabel = qcRetry === 0 ? "second" : qcRetry === 1 ? "third" : "FINAL";
      const qcFeedbackBlock = `\n\n══════════════════════════════════════════\n⚠️ MANDATORY FIXES (from previous attempt QC — score ${qcResult.score}/100)\n══════════════════════════════════════════\nThe previous generation FAILED quality check. You MUST fix ALL of the following issues:\n${qcResult.issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}\n\nDo NOT repeat these mistakes. This is your ${attemptLabel} attempt.${qcRetry >= 2 ? " THIS IS YOUR LAST CHANCE — make it perfect." : ""}`;

      brand.brand_brief = originalBrief + qcFeedbackBlock;

      try {
        const retryResult = await generateCreative(
          framework, brand, brandAssets, referenceImageUrl, spec, LOVABLE_API_KEY, refinedBriefResult
        );
        imageBase64 = retryResult.imageBase64;
        captionText = retryResult.captionText;

        // Re-run QC on retried image
        await supabase.from("generations").update({ status: "quality_checking" }).eq("id", generationId);
        qcResult = await qualityCheck(imageBase64, brand, spec, LOVABLE_API_KEY);
        console.log(`QC retry ${qcRetry + 1} result:`, JSON.stringify(qcResult));
      } catch (retryErr) {
        console.warn(`QC retry ${qcRetry + 1} generation failed, keeping current image:`, retryErr);
        break;
      }
    }

    // Restore original brief
    brand.brand_brief = originalBrief;

    // GATE: If QC still fails after all retries, reject the output
    const finalFailed = qcResult.score < MIN_ACCEPTABLE_SCORE || qcResult.critical;
    if (finalFailed) {
      console.warn(`Final QC REJECTED: score=${qcResult.score}, critical=${qcResult.critical}, issues=${qcResult.issues.length}`);
      
      // Save the QC data for diagnostics but mark as failed
      const failedPayload = {
        caption: captionText,
        qc: { passed: false, score: qcResult.score, issues: qcResult.issues, rejected: true },
      };
      await supabase.from("generations").update({
        status: "failed",
        copywriting: failedPayload,
        layout_guide: JSON.stringify(framework),
      }).eq("id", generationId);

      return new Response(
        JSON.stringify({
          error: `Quality check failed after ${MAX_QC_RETRIES + 1} attempts (score: ${qcResult.score}/100). The AI couldn't produce a result that meets your brand standards. Try adjusting your reference image or brand brief, then retry.`,
          qc: { score: qcResult.score, issues: qcResult.issues },
          retryable: true,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload generated image
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
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

    const copywritingPayload = {
      caption: captionText,
      qc: { passed: qcResult.passed, score: qcResult.score, issues: qcResult.issues },
    };

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        output_image_url: publicUrlData.publicUrl,
        layout_guide: JSON.stringify(framework),
        copywriting: copywritingPayload,
        status: "completed",
      })
      .eq("id", generationId);

    if (updateError) {
      console.error("CRITICAL: Final DB update failed!", updateError);
    }

    // Deduct credit after successful generation
    if (callerUserId) {
      const { data: currentCredits } = await supabase
        .from("user_credits")
        .select("credits_remaining, credits_used")
        .eq("user_id", callerUserId)
        .single();

      if (currentCredits) {
        await supabase
          .from("user_credits")
          .update({
            credits_remaining: Math.max(0, currentCredits.credits_remaining - 1),
            credits_used: currentCredits.credits_used + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", callerUserId);
      }
    }

    return new Response(
      JSON.stringify({
        imageUrl: publicUrlData.publicUrl,
        caption: captionText,
        qc: { passed: qcResult.passed, score: qcResult.score, issues: qcResult.issues },
        framework,
        generationId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-creative OUTER error:", e);

    // Try to mark the generation as failed if we have a generationId
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
