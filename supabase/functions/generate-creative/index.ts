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

function toCompactText(value: unknown, maxChars: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function createFrameworkDigest(framework: Record<string, unknown>): string {
  const layout = (framework as any)?.layout ?? {};
  const style = (framework as any)?.style ?? {};
  const zones = Array.isArray(layout?.zones)
    ? layout.zones.slice(0, 8).map((z: any) => ({
        name: z?.name,
        position: z?.position,
        size: z?.size,
      }))
    : [];
  const textElements = Array.isArray((framework as any)?.text_elements)
    ? (framework as any).text_elements.slice(0, 6).map((t: any) => ({
        type: t?.type,
        position: t?.position,
        font_style: t?.font_style,
      }))
    : [];

  return JSON.stringify(
    {
      layout: {
        orientation: layout?.orientation,
        zones,
      },
      style: {
        background_type: style?.background_type,
        photography_style: style?.photography_style,
        overlay: style?.overlay,
        mood: style?.mood,
      },
      text_elements: textElements,
      composition_notes: toCompactText((framework as any)?.composition_notes, 400),
    },
    null,
    2
  );
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

  const systemPrompt = `You are an expert brand creative designer producing premium, award-winning advertisements.

══════════════════════════════════════════
ABSOLUTE OUTPUT FORMAT REQUIREMENT
══════════════════════════════════════════
The generated image MUST be exactly ${spec.width}×${spec.height} pixels — a ${aspectRatioLabel} format.
${spec.width === spec.height ? "The image MUST be perfectly SQUARE. Equal width and height. NOT landscape, NOT portrait. SQUARE." : ""}
${spec.height > spec.width ? "The image MUST be TALL/VERTICAL (portrait orientation). Height is greater than width." : ""}
${spec.width > spec.height ? "The image MUST be WIDE (landscape orientation). Width is greater than height." : ""}
DO NOT generate an image in any other aspect ratio. This is non-negotiable.

══════════════════════════════════════════
BRAND ASSET FIDELITY — CRITICAL
══════════════════════════════════════════
You are provided with official brand assets (logos, 3D architectural renders, product photos, mascots).
These assets are SACRED and must be used with PIXEL-PERFECT fidelity:
- NEVER redraw, reimagine, recreate, stylize, or modify any provided brand asset
- NEVER change building facades, rooflines, architectural proportions, or structural details from 3D renders
- NEVER alter logo shapes, colors, typography, or proportions
- NEVER replace a provided photo/render with an AI-generated version
- Place each asset in the creative EXACTLY as it appears — same proportions, same details, same colors
- If a 3D architectural render is provided, it must appear with its EXACT geometry, materials, and perspective
- The brand assets are the "source of truth" — the AI must COMPOSITE them into the layout, not regenerate them

══════════════════════════════════════════
NO-DUPLICATION CREATIVE FRAMEWORK
══════════════════════════════════════════
Every element appears EXACTLY ONCE:
1. HERO ZONE: One dominant visual
2. BRAND MARK: Logo appears ONCE. If logo contains brand name, do NOT add brand name as separate text.
3. INFORMATION HIERARCHY: Headline, sub-copy, location, contact, price — each appears in ONE place only.
4. CTA: One clear call-to-action
5. WHITE SPACE: Leave intentional negative space — do not fill every corner

══════════════════════════════════════════
DESIGN FRAMEWORK (from reference analysis — follow this layout structure)
══════════════════════════════════════════
${frameworkJson}

══════════════════════════════════════════
BRAND IDENTITY
══════════════════════════════════════════
${brandContext}

${hasAssets ? `══════════════════════════════════════════
BRAND ASSETS PROVIDED (${selectedAssets.length} images follow the reference)
══════════════════════════════════════════
${assetDescriptions}${omittedAssetsCount > 0 ? `\n(${omittedAssetsCount} additional asset(s) omitted)` : ""}

The FIRST image in the conversation is the REFERENCE advertisement (for layout/style only).
Images 2 onwards are OFFICIAL BRAND ASSETS — use them EXACTLY as-is. Do NOT redraw them.` : `No brand assets provided. Use "${brand.name}" as prominent text.`}

══════════════════════════════════════════
GENERATION INSTRUCTIONS
══════════════════════════════════════════
1. Follow the DESIGN FRAMEWORK layout zones precisely for element placement
2. Replace ALL colors from the reference with brand colors: ${brand.primary_color} primary, ${brand.secondary_color} secondary
3. ${hasAssets ? "COMPOSITE brand assets into the layout at their correct zones — logo in logo zone, architectural renders/product shots in hero zone. DO NOT redraw them." : `Include "${brand.name}" prominently as text.`}
4. Generate FRESH, ORIGINAL headline and copy — never copy from brand brief examples verbatim
5. Match the visual style (background type, overlays, mood) but with brand colors
6. Adapt the framework layout naturally to the ${aspectRatioLabel} format (${spec.width}×${spec.height})
7. Enforce all brand exclusions/negative prompts strictly
8. Scan the final layout to remove any duplicate text, logos, or information
9. FINAL CHECK: Confirm the output is ${spec.width}×${spec.height} (${aspectRatioLabel}) before delivering

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

  // Keep each function invocation short; rely on client-side spaced retries for sustained overload.
  const modelPlan = [
    { model: "google/gemini-3.1-flash-image-preview", retries: 2, timeoutMs: 75000 },
    { model: "google/gemini-2.5-flash-image", retries: 2, timeoutMs: 75000 },
    { model: "google/gemini-3-pro-image-preview", retries: 1, timeoutMs: 90000 },
  ];
  const transientStatuses = new Set([500, 502, 503, 504, 529]);

  let sawOverload = false;
  let sawTruncated = false;
  let sawAnyFailure = false;
  let lastStatus: number | null = null;

  for (const { model, retries, timeoutMs } of modelPlan) {
    console.log(`Using model: ${model}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`[${model}] image generation attempt ${attempt}/${retries}...`);

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
        console.error(`[${model}] attempt ${attempt}: AI error ${aiResponse.status}:`, errText);

        if (aiResponse.status === 429) throw new Error("RATE_LIMITED");
        if (aiResponse.status === 402) throw new Error("CREDITS_EXHAUSTED");

        const isOverloaded = aiResponse.status === 503 || aiResponse.status === 529;
        if (isOverloaded) {
          sawOverload = true;
        }

        if (transientStatuses.has(aiResponse.status) && attempt < retries) {
          const baseDelay = isOverloaded ? 6000 * attempt : 3000 * attempt;
          const jitter = Math.floor(Math.random() * 2000);
          const delay = Math.min(baseDelay + jitter, 15000);
          console.warn(
            `[${model}] transient error (${aiResponse.status}), retrying in ${delay}ms...`
          );
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
        console.warn(`[${model}] attempt ${attempt}: Truncated response body`);
        if (attempt < retries) {
          await sleep(2500);
          continue;
        }
        break;
      }

      const imageBase64 = extractImagePayload(aiData);
      const captionText = extractCaptionText(aiData);

      console.log(`[${model}] attempt ${attempt} response:`, JSON.stringify({
        hasImage: !!imageBase64,
      }));

      if (imageBase64) {
        return { imageBase64, captionText };
      }

      sawAnyFailure = true;
      console.warn(`[${model}] attempt ${attempt}: No image payload returned`);
      if (attempt < retries) {
        await sleep(2000);
      }
    }

    if (model !== modelPlan[modelPlan.length - 1].model) {
      console.warn(`Switching to fallback model after failures on ${model}`);
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

    // Update status to analyzing
    await supabase.from("generations").update({ status: "analyzing" }).eq("id", generationId);

    // ── STEP 1: Analyze reference image → design framework ──
    console.log("Step 1: Analyzing reference image framework...");
    let framework: Record<string, unknown>;
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

    // Store framework and update status
    await supabase
      .from("generations")
      .update({ layout_guide: JSON.stringify(framework), status: "generating" })
      .eq("id", generationId);

    // ── STEP 2: Generate brand creative using framework ──
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

      if (err.message === "RATE_LIMITED") {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (err.message === "CREDITS_EXHAUSTED") {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (err.message === "UPSTREAM_OVERLOADED") {
        return new Response(
          JSON.stringify({ error: "AI provider is temporarily overloaded. Please retry in 20–40 seconds." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
