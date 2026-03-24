import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FORMAT_SPECS: Record<string, { width: number; height: number; label: string }> = {
  landscape: { width: 1920, height: 1080, label: "landscape (1920×1080)" },
  square: { width: 1080, height: 1080, label: "square (1080×1080)" },
  story: { width: 1080, height: 1920, label: "portrait/story (1080×1920)" },
  portrait: { width: 1080, height: 1350, label: "portrait (1080×1350, 4:5)" },
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// Strip reference-specific content from framework while preserving structural/design info
function sanitizeFramework(fw: Record<string, unknown>): Record<string, unknown> {
  const clean = JSON.parse(JSON.stringify(fw));

  // Sanitize zone descriptions — keep name/position/size, replace description with generic role
  if (clean.layout?.zones && Array.isArray(clean.layout.zones)) {
    for (const zone of clean.layout.zones) {
      if (zone.description) {
        // Replace content description with generic role based on zone name
        const name = (zone.name || "").toLowerCase();
        if (/logo/.test(name)) zone.description = "brand logo zone";
        else if (/hero|main|product|image/.test(name)) zone.description = "hero visual zone";
        else if (/headline|title/.test(name)) zone.description = "headline text zone";
        else if (/sub|body|copy/.test(name)) zone.description = "supporting text zone";
        else if (/cta|button|action/.test(name)) zone.description = "call-to-action zone";
        else if (/background|bg/.test(name)) zone.description = "background zone";
        else if (/tag/.test(name)) zone.description = "tagline zone";
        else if (/price|offer/.test(name)) zone.description = "promotional detail zone";
        else if (/disclaim|legal|footer/.test(name)) zone.description = "footer/legal zone";
        else zone.description = "design element zone";
      }
    }
  }

  // Sanitize text_elements — keep type/position/font_style/approximate_size, replace content_description
  if (clean.text_elements && Array.isArray(clean.text_elements)) {
    for (const te of clean.text_elements) {
      if (te.content_description) {
        const type = (te.type || "").toLowerCase();
        if (/headline|title/.test(type)) te.content_description = "headline text";
        else if (/sub/.test(type)) te.content_description = "subcopy text";
        else if (/cta|button/.test(type)) te.content_description = "CTA text";
        else if (/tag/.test(type)) te.content_description = "tagline text";
        else if (/price|offer/.test(type)) te.content_description = "promotional detail";
        else if (/disclaim|legal/.test(type)) te.content_description = "legal/disclaimer text";
        else te.content_description = "text element";
      }
    }
  }

  // Strip any composition_notes that reference specific content
  // Keep it but remove brand-specific mentions
  if (typeof clean.composition_notes === "string") {
    // Remove quoted text fragments, specific brand/location names, prices, currencies
    clean.composition_notes = clean.composition_notes
      .replace(/"[^"]*"/g, '"[text]"')
      .replace(/\b[A-Z]{3}\s*[\d,.]+[MKBmkb]?\b/g, "[price]")
      .replace(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:sq\.?\s*(?:ft|yds?|m)|acres?)\b/gi, "[size]");
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

// ─────────────────────────────────────────────────────
// Step 1 — Analyze reference image design framework
// ─────────────────────────────────────────────────────
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

// Role-specific instructions for each asset category
const ASSET_ROLE_INSTRUCTIONS: Record<string, string> = {
  "Logo": "Place as brand mark — exact fidelity required. Top-left or top-right with contrast backing.",
  "Hero Image": "Use as the primary hero visual. Feature prominently in the main visual zone.",
  "Architecture": "Use as hero visual. Preserve exact geometry, materials, proportions. May adjust lighting/angle for mood.",
  "Lifestyle": "Use as atmospheric background or lifestyle context. Can crop/blend into layout.",
  "Masterplan": "Include in a dedicated zone. Maintain readability and detail.",
  "Product": "Feature prominently with high detail preservation. Center of visual attention.",
  "Mascot": "Place as character element. Preserve exact design, colors, proportions.",
  "Pattern/Texture": "Use as background texture, border accent, or subtle overlay pattern.",
  "Icon": "Small supporting element. Use at specified position, maintain clarity.",
  "Other": "Use in appropriate zone based on visual content.",
};

function getAssetRoleInstruction(label: string): string {
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

  // Build asset list with role hints
  const assetList = brandAssets
    .map(
      (a: any, i: number) =>
        `[${i}] "${a.label || "Unlabeled"}" — Role: ${getAssetRoleInstruction(a.label || "")}`
    )
    .join("\n");

  const brandContext = [
    `Brand: ${brand.name}`,
    `Primary: ${brand.primary_color} | Secondary: ${brand.secondary_color}`,
    extraColorsText ? `Extra colors: ${extraColorsText}` : "",
    brand.brand_voice_rules ? `Voice/Audience: ${toCompactText(brand.brand_voice_rules, 1500)}` : "",
    brand.brand_brief ? `Brand Brief: ${toCompactText(brand.brand_brief, 2500)}` : "",
    brand.negative_prompts ? `NEVER include: ${toCompactText(brand.negative_prompts, 1000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = `You are a senior creative director. Your job is to MAP a reference advertisement's concept, layout, and energy to a specific brand — making every creative decision so the image model only needs to render.

CRITICAL — CONTENT ISOLATION:
The reference image is for LAYOUT, COMPOSITION, and VISUAL STYLE only.
IGNORE ALL text, names, locations, prices, currencies, phone numbers, addresses, URLs, and any written content visible in the reference image.
ALL copy (headline, subcopy, CTA) must come EXCLUSIVELY from the brand data below.

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
- Pick ONE hero visual that best matches the reference's main visual zone — USE YOUR VISUAL JUDGEMENT
- Optionally add ONE supporting asset if the reference has multiple visual zones
- Skip assets that don't fit this layout
- Maximum 4 assets total (fewer = better design)
- For each asset, consider: does its composition, orientation, and content match the reference zone it would fill?

ASSET ROLE MAPPING:
- Logo → Brand mark, exact fidelity
- Architecture/Hero Image → Primary visual, preserve details
- Lifestyle → Atmospheric/background element
- Product → Feature prominently
- Masterplan → Dedicated zone, maintain readability
- Mascot → Character element, preserve design
- Pattern/Texture → Background texture or accent
- Icon → Small supporting element

COPY RULES:
- Headlines must be original, punchy, and aligned to brand voice
- ALL text MUST come from the brand brief and brand data
- If the brand brief contains mandatory text (RERA, contact, location), include it
- CTA should be actionable and brand-appropriate

COLOR RULES:
- Use brand primary for dominant elements (headlines, accent strips, CTA)
- Use secondary for supporting elements
- Ensure sufficient contrast for text readability

TEXT PLACEMENT:
- Text MUST be on solid color zones, gradient overlays, or panels — NEVER on photos/renders
- Create clear visual separation between imagery and text zones

FORMAT: ${spec.label} (${spec.width}×${spec.height})`;

  const userMessage = `DESIGN FRAMEWORK (from reference analysis):
${JSON.stringify(sanitizeFramework(framework), null, 2)}

BRAND DATA:
${brandContext}

AVAILABLE ASSETS (select by index — you can see each one below):
${assetList || "No assets available — design must be text-prominent."}

Look at the reference image AND each brand asset image. Visually evaluate which assets best fit the reference layout zones. Pre-decide all copy, colors, and asset selections.`;

  // Build multimodal content: reference image + all brand asset images
  const userContent: any[] = [
    { type: "text", text: userMessage },
    { type: "text", text: "REFERENCE IMAGE (layout/style inspiration only — ignore all text/content in it):" },
    { type: "image_url", image_url: { url: referenceImageUrl } },
  ];

  // Send actual brand asset images so the Adapt step can SEE them
  for (let i = 0; i < brandAssets.length && i < 8; i++) {
    const asset = brandAssets[i];
    userContent.push(
      { type: "text", text: `BRAND ASSET [${i}] "${asset.label || "Unlabeled"}":` },
      { type: "image_url", image_url: { url: asset.image_url } }
    );
  }

  const response = await fetch(
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "creative_directive",
              description:
                "Output the complete creative directive mapping the reference concept to the brand.",
              parameters: {
                type: "object",
                properties: {
                  headline: {
                    type: "string",
                    description: "Exact headline text, ≤8 words, punchy and brand-aligned",
                  },
                  subcopy: {
                    type: "string",
                    description: "Exact subcopy text, ≤20 words, supporting the headline",
                  },
                  cta_text: {
                    type: "string",
                    description: "Exact CTA text, e.g. 'Enquire Now', 'Shop Now', 'Learn More'",
                  },
                  selected_assets: {
                    type: "array",
                    description: "Which assets to use (by index), their role, placement, and reason",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number", description: "Asset index from the list" },
                        role: {
                          type: "string",
                          description: "logo, hero, supporting, pattern, or background",
                        },
                        placement: {
                          type: "string",
                          description:
                            "Where and how to place it, e.g. 'top-left corner, dark version', 'left 60% of canvas as hero'",
                        },
                        reason: {
                          type: "string",
                          description: "Why this asset was selected for this layout",
                        },
                      },
                      required: ["index", "role", "placement", "reason"],
                      additionalProperties: false,
                    },
                  },
                  color_usage: {
                    type: "object",
                    description: "Exact hex color values for each design element",
                    properties: {
                      background: { type: "string", description: "Background hex color" },
                      headline_color: { type: "string", description: "Headline text hex color" },
                      subcopy_color: { type: "string", description: "Subcopy text hex color" },
                      cta_background: { type: "string", description: "CTA button/strip background hex" },
                      cta_text: { type: "string", description: "CTA text hex color" },
                    },
                    required: ["background", "headline_color", "subcopy_color", "cta_background", "cta_text"],
                    additionalProperties: false,
                  },
                  concept_adaptation: {
                    type: "string",
                    description:
                      "How the reference concept translates to this brand — what replaces what, what energy to keep",
                  },
                  logo_treatment: {
                    type: "string",
                    description:
                      "How to handle the logo: light/dark version, backing panel, size, contrast notes",
                  },
                  compliance_notes: {
                    type: "string",
                    description:
                      "Any brand brief rules to enforce or negative prompts to respect",
                  },
                },
                required: [
                  "headline",
                  "subcopy",
                  "cta_text",
                  "selected_assets",
                  "color_usage",
                  "concept_adaptation",
                  "logo_treatment",
                  "compliance_notes",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: {
          type: "function",
          function: { name: "creative_directive" },
        },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Adapt directive error:", response.status, errText);
    throw new Error(`Adapt directive failed (${response.status})`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
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
}

// ─────────────────────────────────────────────────────
// Step 3 — Generate creative with directive
// ─────────────────────────────────────────────────────
function buildDirectivePrompt(
  directive: CreativeDirective,
  framework: Record<string, unknown>,
  brand: any,
  selectedAssets: any[],
  spec: { width: number; height: number; label: string }
): string {
  const aspectRatioLabel =
    spec.width === spec.height
      ? "1:1 SQUARE"
      : spec.width > spec.height
        ? `${spec.width}:${spec.height} LANDSCAPE`
        : `${spec.width}:${spec.height} PORTRAIT`;

  // Build concise asset placement lines with role-specific hints
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

  const negativePrompts = toCompactText(brand.negative_prompts, 800);

  // SIMPLIFIED prompt — ~30 lines of core instructions
  return `OUTPUT: ${spec.width}×${spec.height} pixels (${aspectRatioLabel}).

CONTENT ISOLATION: Reference image (IMAGE 1) = LAYOUT ONLY. Copy NO text/names/locations from it.

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
• Follow reference layout/composition/energy — adapt with brand assets + colors
• Logo: reproduce EXACT letterforms, shapes, colors from the provided logo image. NEVER write "LOGO" as text
• Architecture/3D: preserve exact building geometry. May enhance lighting/angle
• Text on solid zones or panels only — NEVER on photos/renders
• Headline bold + large, subcopy medium, CTA clean. Max 3 hierarchy levels
• If logo contains brand name, do NOT repeat as text
${negativePrompts ? `• ⛔ NEVER: ${negativePrompts}` : ""}

Generate ${spec.width}×${spec.height} now.`;
}

function buildFallbackPrompt(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  spec: { width: number; height: number; label: string }
): string {
  const extraColorsText =
    brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
      ? `Additional Colors:\n${brand.extra_colors.map((c: any) => `  - ${c.name || "Unnamed"}: ${c.hex}`).join("\n")}`
      : "";

  const brandVoice = toCompactText(brand.brand_voice_rules, 2000);
  const negativePrompts = toCompactText(brand.negative_prompts, 2000);
  const brandBrief = toCompactText(brand.brand_brief, 3000);

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

  const logoAssets = selectedAssets.filter((a: any) => /logo/i.test(a.label || ""));
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
    ...architectureAssets.map((a: any) => `  🏗️ 3D RENDER: "${a.label || "Architecture"}" — Hero visual. May enhance lighting/angle.`),
    ...heroAssets.map((a: any) => `  🖼️ HERO: "${a.label || "Visual"}" — Primary/secondary visual.`),
    ...otherAssets.map((a: any) => `  📎 ASSET: "${a.label || "Asset"}" — Use in appropriate zone.`),
  ].join("\n");

  const aspectRatioLabel =
    spec.width === spec.height
      ? "1:1 SQUARE"
      : spec.width > spec.height
        ? `${spec.width}:${spec.height} LANDSCAPE`
        : `${spec.width}:${spec.height} PORTRAIT`;

  const frameworkJson = JSON.stringify(sanitizeFramework(framework), null, 2);

  return `MANDATORY OUTPUT: ${spec.width}×${spec.height} pixels (${aspectRatioLabel}). No other size.

CONTENT ISOLATION: The reference image (IMAGE 1) is for LAYOUT and VISUAL STYLE only. NEVER copy any text, names, locations, prices, currencies from it. ALL text comes from brand data below.

═══ DESIGN DIRECTION ═══
Follow the reference image's layout, composition, and visual energy. Adapt it to the brand assets and colors below. The reference shows the DESIGN APPROACH — replicate its spatial relationships, visual weight distribution, and compositional style, but with the brand's own content.

LOGO: The brand logo is provided as a separate labeled image. Study it carefully and reproduce its EXACT letterforms, icon shapes, colors, and proportions. On dark backgrounds add a light backing panel. The logo in the REFERENCE image is NOT the brand's logo — ignore it. NEVER write the word "LOGO" as text.
3D RENDERS: Preserve exact architecture. May enhance lighting/angle/atmosphere.
ASSET FIDELITY: Faithfully reproduce logos and product photos with high fidelity. Only adjust scale and contrast.
TEXT PLACEMENT: Text MUST be on solid color zones, gradient overlays, or dedicated panels — NEVER on photos/renders.
COMPOSITION: Clear hierarchy. Hero visual prominent. Breathing room between elements.
TYPOGRAPHY: Headline ≤8 words bold. Subcopy ≤20 words. CTA clean. All text legible.
DEDUPLICATION: No repeated elements.

═══ BRAND DATA ═══
${brandContext}
${brandBrief ? `\nBrand Brief instructions are MANDATORY. ALL copy must come from brand data.` : ""}
${negativePrompts ? `\n⛔ NEVER INCLUDE: ${negativePrompts}` : ""}

═══ REFERENCE FRAMEWORK ═══
${frameworkJson}

${hasAssets ? `BRAND ASSETS (${selectedAssets.length} images provided after reference):
${assetRoleDescriptions}` : `No assets. Use "${brand.name}" text with brand colors.`}

CHECKLIST:
✅ ${spec.width}×${spec.height} (${aspectRatioLabel})
✅ Logo visible, contrasted
✅ Brand colors: ${brand.primary_color} primary, ${brand.secondary_color} secondary
✅ No text/content copied from reference
✅ Text on clean backgrounds, not on imagery
✅ Professional quality

Output: ${spec.width}×${spec.height} pixels. Generate now.`;
}

async function generateCreative(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  referenceImageUrl: string,
  spec: { width: number; height: number; label: string },
  apiKey: string,
  directive: CreativeDirective | null
): Promise<{ imageBase64: string; captionText: string }> {
  let systemPrompt: string;
  let selectedAssets: any[];

  if (directive) {
    // Use directive-selected assets
    const validIndices = directive.selected_assets
      .map((sa) => sa.index)
      .filter((i) => i >= 0 && i < brandAssets.length);
    selectedAssets = validIndices.map((i) => {
      const asset = { ...brandAssets[i], _originalIndex: i };
      return asset;
    });

    // If directive selected no valid assets, fall back to first few
    if (selectedAssets.length === 0 && brandAssets.length > 0) {
      selectedAssets = brandAssets.slice(0, 3).map((a: any, i: number) => ({ ...a, _originalIndex: i }));
    }

    systemPrompt = buildDirectivePrompt(directive, framework, brand, selectedAssets, spec);
  } else {
    // Fallback: no directive available
    selectedAssets = brandAssets.slice(0, 5);
    systemPrompt = buildFallbackPrompt(framework, brand, brandAssets, spec);
  }

  const hasAssets = selectedAssets.length > 0;

  // Build user content with explicit role labels for each image
  const userContent: any[] = [
    {
      type: "text",
      text: `Output MUST be ${spec.width}×${spec.height} pixels. All text from Creative Directive only.`,
    },
    {
      type: "text",
      text: "IMAGE 1 — REFERENCE (composition/layout/style only — IGNORE all text, logos, names, locations visible in it):",
    },
    {
      type: "image_url",
      image_url: { url: referenceImageUrl },
    },
  ];

  if (directive) {
    // Sort assets so logo comes first (IMAGE 2, right after reference) for maximum model attention
    const sortedAssets = [...directive.selected_assets].sort((a, b) => {
      const aIsLogo = a.role.toUpperCase() === "LOGO" ? 0 : 1;
      const bIsLogo = b.role.toUpperCase() === "LOGO" ? 0 : 1;
      return aIsLogo - bIsLogo;
    });

    for (const sa of sortedAssets) {
      const asset = selectedAssets.find((a: any) => (a._originalIndex ?? -1) === sa.index);
      if (!asset) continue;
      const roleLabel = sa.role.toUpperCase();
      const imageNum = userContent.filter(c => c.type === "image_url").length + 1;
      let labelText: string;
      if (roleLabel === "LOGO") {
        labelText = `IMAGE ${imageNum} — BRAND LOGO (study this carefully — reproduce its exact letterforms, colors, shapes, and proportions in the final output. This is the ONLY logo to use, ignore any logo in IMAGE 1):`;
      } else {
        labelText = `IMAGE ${imageNum} — ${roleLabel} (${sa.placement}):`;
      }
      userContent.push(
        { type: "text", text: labelText },
        { type: "image_url", image_url: { url: asset.image_url } }
      );
    }
  } else {
    for (const asset of selectedAssets) {
      const label = (asset.label || "Asset").toUpperCase();
      const isLogo = /\b(logo|logomark|brand\s*mark|brand\s*logo|symbol|monogram|emblem)\b/i.test(asset.label || "");
      const roleHint = isLogo ? "BRAND LOGO — must appear in output" : `BRAND ASSET (${label})`;
      userContent.push(
        {
          type: "text",
          text: `IMAGE ${userContent.filter(c => c.type === "image_url").length + 1} — ${roleHint}:`,
        },
        {
          type: "image_url",
          image_url: { url: asset.image_url },
        }
      );
    }
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
      if (isOverloaded) sawOverload = true;

      if (transientStatuses.has(aiResponse.status)) {
        const delay = isOverloaded ? 2500 : 1200;
        console.warn(`[${model}] transient error (${aiResponse.status}), pausing ${delay}ms...`);
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
      console.warn(`[${model}] Truncated response body`);
      await sleep(1000);
      continue;
    }

    const imageBase64 = extractImagePayload(aiData);
    const captionText = extractCaptionText(aiData);

    console.log(`[${model}] response:`, JSON.stringify({ hasImage: !!imageBase64 }));

    if (imageBase64) {
      return { imageBase64, captionText };
    }

    sawAnyFailure = true;
    console.warn(`[${model}] No image payload returned`);
    await sleep(800);
  }

  if (sawOverload) throw new Error("UPSTREAM_OVERLOADED");
  if (sawTruncated) throw new Error("AI_TRUNCATED_RESPONSE");
  if (lastStatus !== null) throw new Error(`AI generation failed (${lastStatus})`);
  if (sawAnyFailure) throw new Error("AI generation failed");
  throw new Error("NO_IMAGE_GENERATED");
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── Credit check ──
    // Get user_id from the generation record
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
        .update({ layout_guide: JSON.stringify(framework), status: "adapting" })
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
        LOVABLE_API_KEY
      );
      console.log("Adapt directive created successfully");
    } catch (err) {
      console.warn("Adapt step failed, falling back to direct generation:", err);
      // directive stays null — generateCreative will use fallback prompt
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
        LOVABLE_API_KEY,
        directive
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
            error:
              "AI providers are busy right now. Your layout analysis was saved, so retrying will skip that step.",
            retryable: true,
            retryAfterSeconds: 45,
            analysisReused: !!existingFramework,
            cachedPreview: existingImageUrl || undefined,
            cachedCaption: existingCaption || undefined,
          }),
          {
            status: 503,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": "45",
            },
          }
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
          {
            status: Number.isFinite(statusCode) ? statusCode : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: err?.message || "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    // Use directive caption if the image model didn't provide one
    const finalCaption =
      captionText ||
      (directive
        ? `${directive.headline}\n${directive.subcopy}\n${directive.cta_text}`
        : "");

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        output_image_url: publicUrlData.publicUrl,
        layout_guide: JSON.stringify(framework),
        copywriting: { caption: finalCaption },
        status: "completed",
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
