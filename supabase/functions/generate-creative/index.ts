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

/** Step 2 — Generate the brand creative using the framework */
async function generateCreative(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  referenceImageUrl: string,
  spec: { width: number; height: number; label: string },
  apiKey: string
): Promise<{ imageBase64: string; captionText: string }> {
  const extraColorsText = brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
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
  const omittedAssetsCount = Math.max(brandAssets.length - selectedAssets.length, 0);
  const hasAssets = selectedAssets.length > 0;
  const assetDescriptions = selectedAssets
    .map((a: any, i: number) => `  - Image ${i + 1}: ${a.label || "Brand asset"}`)
    .join("\n");

  // Use full framework for higher fidelity
  const frameworkJson = JSON.stringify(framework, null, 2);

  // Determine aspect ratio label for strong enforcement
  const aspectRatioLabel = spec.width === spec.height ? "1:1 SQUARE" 
    : spec.width > spec.height ? `${spec.width}:${spec.height} LANDSCAPE` 
    : `${spec.width}:${spec.height} PORTRAIT/STORY`;

  // Categorize assets by label for intelligent placement
  const logoAssets = selectedAssets.filter((a: any) => /logo/i.test(a.label || ""));
  const architectureAssets = selectedAssets.filter((a: any) => /architect|3d|render|building|elevation|facade/i.test(a.label || ""));
  const heroAssets = selectedAssets.filter((a: any) => /hero|lifestyle|product|mascot|master/i.test(a.label || ""));
  const otherAssets = selectedAssets.filter((a: any) => 
    !logoAssets.includes(a) && !architectureAssets.includes(a) && !heroAssets.includes(a)
  );

  const assetRoleDescriptions = [
    ...logoAssets.map((a: any, i: number) => `  🔷 LOGO: "${a.label || "Logo"}" — Place in brand mark zone. Adjust contrast for readability (see LOGO CONTRAST rules).`),
    ...architectureAssets.map((a: any, i: number) => `  🏗️ 3D RENDER: "${a.label || "Architecture"}" — Use as hero visual. You MAY creatively adjust lighting, angle, and atmosphere (see 3D RENDER rules).`),
    ...heroAssets.map((a: any, i: number) => `  🖼️ HERO/LIFESTYLE: "${a.label || "Visual"}" — Use as primary or secondary visual in the layout.`),
    ...otherAssets.map((a: any, i: number) => `  📎 ASSET: "${a.label || "Brand asset"}" — Use as provided in appropriate zone.`),
  ].join("\n");

  const systemPrompt = `You are an elite creative director at a top-tier advertising agency. You produce award-winning, publication-ready advertisements that win Cannes Lions and D&AD Pencils.

══════════════════════════════════════════
ABSOLUTE OUTPUT FORMAT REQUIREMENT
══════════════════════════════════════════
The generated image MUST be exactly ${spec.width}×${spec.height} pixels — a ${aspectRatioLabel} format.
${spec.width === spec.height ? "The image MUST be perfectly SQUARE. Equal width and height. NOT landscape, NOT portrait. SQUARE." : ""}
${spec.height > spec.width ? "The image MUST be TALL/VERTICAL (portrait orientation). Height is greater than width." : ""}
${spec.width > spec.height ? "The image MUST be WIDE (landscape orientation). Width is greater than height." : ""}
DO NOT generate an image in any other aspect ratio. This is non-negotiable.

══════════════════════════════════════════
🎨 LOGO CONTRAST & READABILITY — CRITICAL
══════════════════════════════════════════
The logo MUST always be clearly visible and readable against its background:
- On DARK backgrounds (dark photos, dark gradients, dark colors): Use a WHITE or LIGHT version of the logo. If only a dark logo is provided, place it on a light panel/strip or add a subtle light backing.
- On LIGHT backgrounds: Use the logo as-is or in dark form.
- On BUSY/PHOTOGRAPHIC backgrounds: Place the logo in a clear zone with a semi-transparent backing panel, solid color strip, or adequate padding from complex imagery.
- The logo must NEVER blend into or get lost against the background.
- Ensure minimum contrast ratio for professional readability.
- If the brand has both light and dark color variants, choose the one that contrasts best.

══════════════════════════════════════════
🏗️ 3D ARCHITECTURAL RENDERS — CREATIVE FREEDOM
══════════════════════════════════════════
3D renders (buildings, elevations, facades, interiors) are REFERENCE MATERIAL showing the project's design:
- You MUST preserve the EXACT architecture: building shape, facade design, rooflines, structural proportions, materials, window patterns, floor counts.
- You MAY and SHOULD creatively enhance:
  • LIGHTING: Golden hour, dramatic twilight, night illumination, dawn light — choose what works best for the creative's mood
  • ANGLE/PERSPECTIVE: Show from a different viewpoint if it creates a more compelling composition — aerial, street-level, 3/4 view, dramatic low angle
  • ATMOSPHERE: Add environmental context — city streetscape, landscaping, sky drama, reflections, people/life
  • CROPPING: Focus on the most visually striking portion of the building
- The goal is to make the architecture look ASPIRATIONAL and PREMIUM while keeping it architecturally accurate
- Think of it as a render artist re-rendering the same building with better art direction

══════════════════════════════════════════
🔒 LOGO & PRODUCT ASSET FIDELITY
══════════════════════════════════════════
For LOGOS, PRODUCT PHOTOS, and MASCOTS (NOT 3D renders):
- NEVER redraw, reimagine, recreate, or stylize these assets
- Place them EXACTLY as provided — same proportions, same details
- Only adjust: size/scale to fit layout, and contrast adaptation (light/dark version)
- These are the literal brand marks — pixel-perfect fidelity required

══════════════════════════════════════════
📐 PROFESSIONAL DESIGN QUALITY STANDARDS
══════════════════════════════════════════
Every creative must meet these professional standards:

COMPOSITION:
- Clear visual hierarchy: Eye should flow naturally from hero → headline → supporting info → CTA
- The hero visual (3D render, product, lifestyle image) should occupy 50-70% of the canvas
- Important parts of the hero image must NEVER be obscured by text overlays or other elements
- Use the rule of thirds for element placement
- Intentional negative space — white space is a design element, not wasted space

TYPOGRAPHY & COPY:
- Headline: Maximum 6-8 words. Punchy, memorable, benefit-driven. Large, bold, impossible to miss.
- Sub-copy: Maximum 15-20 words. One supporting sentence. Medium size.
- CTA/Contact: Small, clean, bottom zone. Phone, website, or action.
- ALL text must be LEGIBLE — proper size, proper contrast, proper spacing
- Never stack more than 3 levels of text hierarchy
- Text should NEVER overlap with critical parts of imagery (faces, architectural details, product features)

COLOR:
- Use brand primary color for dominant elements (backgrounds, headlines, accent strips)
- Use brand secondary color for supporting elements (sub-copy, borders, secondary panels)
- Maintain professional color harmony — don't use ALL brand colors everywhere
- Background color choices should complement the hero imagery

LAYOUT ZONES (each appears EXACTLY ONCE):
1. HERO ZONE (50-70%): One dominant visual — the 3D render, product shot, or lifestyle image
2. BRAND MARK: Logo appears ONCE, clearly visible, properly contrasted
3. HEADLINE: One powerful headline, large and bold
4. SUPPORTING COPY: Brief sub-copy or tagline
5. INFO BAR: Contact/CTA/location — compact, bottom or side strip
6. NEGATIVE SPACE: Breathing room between elements — do NOT fill every pixel

DEDUPLICATION:
- If the logo contains the brand name, do NOT repeat the brand name as separate text
- Location appears ONCE (not in headline AND info bar)
- Price/offer appears ONCE
- Contact info appears ONCE

══════════════════════════════════════════
📋 BRAND GUIDELINES — MANDATORY RULES
══════════════════════════════════════════
The following brand guidelines are NOT suggestions — they are MANDATORY rules that MUST be followed in every creative without exception:

${brandContext}

${brandBrief ? `\nThe Brand Brief above contains specific instructions about visual style, messaging, target audience, and mandatory/forbidden elements. Treat EVERY instruction in the brief as a hard requirement. Examples of copy in the brief are for TONE REFERENCE ONLY — generate original copy, never copy verbatim.` : ""}
${negativePrompts ? `\n⛔ STRICT EXCLUSIONS — The following must NEVER appear in any creative:\n${negativePrompts}` : ""}

══════════════════════════════════════════
DESIGN FRAMEWORK (from reference analysis)
══════════════════════════════════════════
Follow this layout structure as a guide, adapting it to the brand:
${frameworkJson}

${hasAssets ? `══════════════════════════════════════════
BRAND ASSETS PROVIDED (${selectedAssets.length} images)
══════════════════════════════════════════
${assetRoleDescriptions}${omittedAssetsCount > 0 ? `\n(${omittedAssetsCount} additional asset(s) omitted)` : ""}

The FIRST image is the REFERENCE advertisement (for layout/composition inspiration only).
Images 2+ are OFFICIAL BRAND ASSETS — use them according to their role described above.` : `No brand assets provided. Use "${brand.name}" as prominent text with brand colors.`}

══════════════════════════════════════════
GENERATION CHECKLIST
══════════════════════════════════════════
Before generating, mentally verify:
✅ Output is ${spec.width}×${spec.height} (${aspectRatioLabel})
✅ Hero visual occupies 50-70% and its important features are fully visible
✅ Logo is clearly visible with proper contrast against its background
✅ Headline is ≤8 words, large, bold, original (not from brief examples)
✅ Sub-copy is ≤20 words, supporting the headline
✅ No element is duplicated (logo, brand name, location, price)
✅ Text never obscures critical parts of imagery
✅ Brand colors are applied: ${brand.primary_color} primary, ${brand.secondary_color} secondary
✅ All brand brief mandatory rules are followed
✅ All negative prompts / exclusions are respected
✅ Intentional negative space exists — layout breathes
✅ Professional, premium quality — worthy of a print magazine

Generate the brand-aligned creative image now.`;

  // Build message content
  const userContent: any[] = [
    {
      type: "text",
      text: hasAssets
        ? `The FIRST image is the reference advertisement for visual style context. The following ${selectedAssets.length} image(s) are official brand assets — use them EXACTLY as provided in the generated creative. Follow the design framework precisely.`
        : "Use the reference image for visual style context and follow the design framework to generate the brand creative.",
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

  // Prefer one high-quality attempt per model to avoid cascading 429s under load.
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
        .update({ layout_guide: JSON.stringify(framework), status: "generating" })
        .eq("id", generationId);
    }

    console.log("Step 2: Generating brand creative...");
    let imageBase64: string;
    let captionText: string;
    try {
      const result = await generateCreative(
        framework, brand, brandAssets, referenceImageUrl, spec, LOVABLE_API_KEY
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

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        output_image_url: publicUrlData.publicUrl,
        layout_guide: JSON.stringify(framework),
        copywriting: { caption: captionText },
        status: "completed",
      })
      .eq("id", generationId);

    if (updateError) {
      console.error("CRITICAL: Final DB update failed!", updateError);
      // Still return the image to the client even if DB update fails
    }

    return new Response(
      JSON.stringify({
        imageUrl: publicUrlData.publicUrl,
        caption: captionText,
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
