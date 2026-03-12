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

  const brandContext = [
    `Brand Name: ${brand.name}`,
    `Primary Color: ${brand.primary_color}`,
    `Secondary Color: ${brand.secondary_color}`,
    extraColorsText,
    brand.brand_voice_rules ? `Tone & Audience: ${brand.brand_voice_rules}` : "",
    brand.negative_prompts ? `STRICT EXCLUSIONS (never include these): ${brand.negative_prompts}` : "",
    brand.brand_brief ? `Brand Guidelines & Brief:\n${brand.brand_brief}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const hasAssets = brandAssets.length > 0;
  const assetDescriptions = brandAssets
    .map((a: any, i: number) => `  - Image ${i + 1}: ${a.label || "Brand asset"}`)
    .join("\n");

  const frameworkJson = JSON.stringify(framework, null, 2);

  const systemPrompt = `You are an expert brand creative designer. You have been given a precise DESIGN FRAMEWORK extracted from a reference advertisement, along with a brand identity and brand assets. Your job is to generate a NEW advertisement image that follows the framework exactly but is fully adapted to the brand.

══════════════════════════════════════════
AWARD-WINNING CREATIVE FRAMEWORK — NO DUPLICATION RULES
══════════════════════════════════════════
Every element on the creative must appear EXACTLY ONCE. Follow this hierarchy:

1. HERO ZONE (largest visual area):
   - One dominant visual — either a product/building photo OR an illustration. Never both competing.

2. BRAND MARK (one instance only):
   - The logo appears ONCE in its designated zone. Do NOT repeat it anywhere else.
   - If the logo contains the brand name, do NOT also write the brand name as separate text.

3. INFORMATION HIERARCHY (each piece of info appears in ONE place only):
   - Headline: One punchy line that conveys the core message.
   - Sub-copy (optional): One supporting line — NOT a restatement of the headline.
   - Location/Address: Appears ONCE — either in the footer strip OR near a map pin, never both.
   - Contact info (phone/website): Appears ONCE in the footer or CTA zone.
   - Price/offer: Appears ONCE, prominently.
   - Legal/RERA: Appears ONCE in small text, typically bottom edge.

4. CALL-TO-ACTION: One clear CTA. Do not scatter multiple CTAs.

5. DEDUPLICATION CHECKLIST (strictly enforce):
   - If the brand name is in the logo, do NOT add it as separate text.
   - If the project name is in the headline, do NOT repeat it in sub-copy.
   - If the location is mentioned in the headline, do NOT add a separate location line.
   - If a phone number appears in the CTA, do NOT also put it in the footer.
   - Never show two maps or two location references.
   - Never show the same decorative motif more than once unless it's a deliberate pattern.

6. WHITE SPACE: Award-winning creatives breathe. Leave intentional negative space — do not fill every corner with text or graphics.
══════════════════════════════════════════

DESIGN FRAMEWORK (follow this EXACTLY):
${frameworkJson}

BRAND IDENTITY:
${brandContext}

OUTPUT FORMAT: ${spec.label} — The generated image MUST be exactly ${spec.width}×${spec.height} pixels.

${hasAssets ? `BRAND ASSETS: ${brandAssets.length} brand images are provided. These include logos, product photos, building shots, mascots, etc.:
${assetDescriptions}

CRITICAL RULES FOR BRAND ASSETS:
- Use logos EXACTLY as provided — do NOT redraw, reimagine, or recreate them.
- Place the logo in the "${(framework as any).layout?.zones?.find((z: any) => z.name === "logo")?.position || "top-left"}" position as specified in the framework.
- Product photos, building shots, and other assets should be naturally integrated into the composition in their respective zones.` : `No brand assets were provided. Use the brand name "${brand.name}" as prominent text instead of a logo.`}

INSTRUCTIONS:
1. Follow the DESIGN FRAMEWORK layout zones precisely — place each element in its specified position and size.
2. Apply the brand's colors: ${brand.primary_color} as primary, ${brand.secondary_color} as secondary. Replace the reference's color scheme entirely.
3. ${hasAssets ? "Place each brand asset in its natural zone. Logo goes in the logo zone. Product images go in product/hero zones." : `Include "${brand.name}" prominently as text.`}
4. COPY ORIGINALITY (CRITICAL): Generate FRESH, ORIGINAL headline and copy for every creative. If the brand brief contains example headlines or copy, treat them ONLY as tone/style references — NEVER copy them verbatim. Study the examples to understand the brand's voice, rhythm, and messaging themes, then craft entirely new lines that feel equally on-brand but are unique. Vary sentence structure, word choice, and angle each time.
5. Match the visual style described in the framework (background type, overlays, mood) but with the brand's colors.
6. The final image must look like a polished, professional advertisement.
7. Adapt the framework layout to fit ${spec.label} format (${spec.width}×${spec.height}) naturally.
8. Apply any brand guidelines strictly. Respect all exclusions.
9. CRITICAL: Apply the NO DUPLICATION RULES above — every text element, logo, location, and contact info must appear EXACTLY ONCE. Scan the layout before finalizing to remove any duplicates.

Generate the brand-aligned creative image now.`;

  // Build message content
  const userContent: any[] = [
    {
      type: "text",
      text: hasAssets
        ? `The FIRST image is the reference advertisement for visual style context. The following ${brandAssets.length} image(s) are official brand assets — use them EXACTLY as provided in the generated creative. Follow the design framework precisely.`
        : "Use the reference image for visual style context and follow the design framework to generate the brand creative.",
    },
    {
      type: "image_url",
      image_url: { url: referenceImageUrl },
    },
  ];

  for (const asset of brandAssets) {
    userContent.push({
      type: "image_url",
      image_url: { url: (asset as any).image_url },
    });
  }

  // Retry with availability-first fallback to reduce overload failures.
  const modelPlan = [
    { model: "google/gemini-3.1-flash-image-preview", retries: 4, timeoutMs: 120000 },
    { model: "google/gemini-2.5-flash-image", retries: 3, timeoutMs: 120000 },
    { model: "google/gemini-3-pro-image-preview", retries: 2, timeoutMs: 150000 },
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
          const baseDelay = isOverloaded ? 3500 * attempt : 2200 * attempt;
          const jitter = Math.floor(Math.random() * 1200);
          const delay = Math.min(baseDelay + jitter, 12000);
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
