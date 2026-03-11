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
  const brandContext = [
    `Brand Name: ${brand.name}`,
    `Primary Color: ${brand.primary_color}`,
    `Secondary Color: ${brand.secondary_color}`,
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
4. Generate appropriate headline text and call-to-action text that match the brand's tone.
5. Match the visual style described in the framework (background type, overlays, mood) but with the brand's colors.
6. The final image must look like a polished, professional advertisement.
7. Adapt the framework layout to fit ${spec.label} format (${spec.width}×${spec.height}) naturally.
8. Apply any brand guidelines strictly. Respect all exclusions.

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

  const aiResponse = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-pro-image-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        modalities: ["image", "text"],
      }),
    }
  );

  if (!aiResponse.ok) {
    const errText = await aiResponse.text();
    console.error("AI generation error:", aiResponse.status, errText);

    if (aiResponse.status === 429) throw new Error("RATE_LIMITED");
    if (aiResponse.status === 402) throw new Error("CREDITS_EXHAUSTED");
    throw new Error(`AI generation failed (${aiResponse.status})`);
  }

  const aiData = await aiResponse.json();
  const imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const captionText = aiData.choices?.[0]?.message?.content || "";

  if (!imageBase64) throw new Error("NO_IMAGE_GENERATED");

  return { imageBase64, captionText };
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
      if (err.message === "NO_IMAGE_GENERATED") {
        return new Response(
          JSON.stringify({ error: "No image was generated. Try again." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
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

    await supabase
      .from("generations")
      .update({
        output_image_url: publicUrlData.publicUrl,
        layout_guide: JSON.stringify(framework),
        status: "completed",
      })
      .eq("id", generationId);

    return new Response(
      JSON.stringify({
        imageUrl: publicUrlData.publicUrl,
        caption: captionText,
        framework,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-creative error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
