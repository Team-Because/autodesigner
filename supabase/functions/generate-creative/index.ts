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

// ─── Brand brief helpers ───

function getRenderedBrandBrief(brandBrief: unknown): string {
  if (typeof brandBrief !== "string" || !brandBrief.trim()) return "";
  try {
    const parsed = JSON.parse(brandBrief);
    if (parsed?._structured && typeof parsed?._rendered === "string") return parsed._rendered.trim();
  } catch { /* legacy */ }
  return brandBrief.trim();
}

function extractCaptionText(aiData: any): string {
  const content = aiData?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p: any) => p?.type === "text" && typeof p?.text === "string")
      .map((p: any) => p.text)
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
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

// ─── Step 1: Analyze reference image ───

async function analyzeFramework(
  referenceImageUrl: string,
  apiKey: string
): Promise<Record<string, unknown>> {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are an expert visual design analyst. Analyze the given advertisement image and extract a precise structural framework — layout zones, visual style, text hierarchy, and composition notes. Be specific about positions and sizes.`,
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this advertisement and extract its complete design framework." },
            { type: "image_url", image_url: { url: referenceImageUrl } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "extract_design_framework",
            description: "Extract a structured design framework from the reference image.",
            parameters: {
              type: "object",
              properties: {
                layout: {
                  type: "object",
                  properties: {
                    orientation: { type: "string", description: "landscape, portrait, or square" },
                    zones: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string", description: "Zone name: logo, headline, hero_image, cta, product, background, subtext, tagline" },
                          position: { type: "string", description: "e.g. top-left, center, bottom-right" },
                          size: { type: "string", description: "tiny, small, medium, large, half, full" },
                          description: { type: "string", description: "What occupies this zone" },
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
                    background_type: { type: "string" },
                    photography_style: { type: "string" },
                    overlay: { type: "string" },
                    mood: { type: "string" },
                    color_scheme: { type: "string" },
                  },
                  required: ["background_type", "photography_style", "overlay", "mood", "color_scheme"],
                  additionalProperties: false,
                },
                text_elements: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", description: "headline, subtext, cta, tagline, disclaimer, price" },
                      content_description: { type: "string" },
                      position: { type: "string" },
                      font_style: { type: "string" },
                      approximate_size: { type: "string" },
                    },
                    required: ["type", "content_description", "position", "font_style", "approximate_size"],
                    additionalProperties: false,
                  },
                },
                composition_notes: { type: "string", description: "Notes about symmetry, focal point, whitespace, visual flow" },
              },
              required: ["layout", "style", "text_elements", "composition_notes"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "extract_design_framework" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Framework analysis error:", response.status, errText);
    throw new Error(`Framework analysis failed (${response.status})`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("No framework extracted from reference image");
  return JSON.parse(toolCall.function.arguments);
}

// ─── Step 2: Generate the creative ───

async function generateCreative(
  framework: Record<string, unknown>,
  brand: any,
  brandAssets: any[],
  referenceImageUrl: string,
  spec: { width: number; height: number; label: string; ratio: string },
  apiKey: string
): Promise<{ imageBase64: string; captionText: string }> {
  const renderedBrief = getRenderedBrandBrief(brand.brand_brief);
  const extraColorsText =
    brand.extra_colors && Array.isArray(brand.extra_colors) && brand.extra_colors.length > 0
      ? brand.extra_colors.map((c: any) => `  - ${c.name || "Unnamed"}: ${c.hex}`).join("\n")
      : "";
  const voiceRules = (brand.brand_voice_rules || "").trim();
  const negativePrompts = (brand.negative_prompts || "").trim();

  // Deduplicate assets and pick up to 5
  const dedupedAssets = brandAssets.filter((a: any, i: number, all: any[]) =>
    i === all.findIndex((c: any) => c.image_url === a.image_url)
  );
  const logoAssets = dedupedAssets.filter((a: any) => /logo/i.test(a.label || ""));
  const otherAssets = dedupedAssets.filter((a: any) => !/logo/i.test(a.label || ""));
  const selectedAssets = [...logoAssets.slice(0, 1), ...otherAssets.slice(0, 4)].slice(0, 5);
  const hasAssets = selectedAssets.length > 0;

  const assetDescriptions = selectedAssets
    .map((a: any) => `  • "${a.label || "Brand asset"}" — use as provided, do not redraw.`)
    .join("\n");

  const systemPrompt = `You are an elite creative director producing a publication-ready advertisement.

═══ OUTPUT FORMAT (CRITICAL) ═══
Generate EXACTLY a ${spec.ratio} image (${spec.width}×${spec.height}).
${spec.height > spec.width ? "The image MUST be VERTICAL (portrait)." : spec.width > spec.height ? "The image MUST be HORIZONTAL (landscape)." : "The image MUST be perfectly SQUARE."}
The output aspect ratio MUST be ${spec.ratio} regardless of the reference image's aspect ratio.

═══ REFERENCE IMAGE RULES ═══
The reference image is STRUCTURAL INSPIRATION ONLY:
- Copy the LAYOUT, COMPOSITION, and VISUAL HIERARCHY from it.
- NEVER copy its text, language, logos, brand identity, or exact imagery.
- Adapt the composition to fit ${spec.ratio} — recompose zones as needed.

═══ BRAND CONTEXT ═══
Brand: ${brand.name}
Primary Color: ${brand.primary_color}
Secondary Color: ${brand.secondary_color}
${extraColorsText ? `Additional Colors:\n${extraColorsText}` : ""}
${voiceRules ? `Voice & Tone: ${voiceRules}` : ""}
${negativePrompts ? `⛔ NEVER USE: ${negativePrompts}` : ""}

${renderedBrief ? `═══ BRAND GUIDELINES ═══\n${renderedBrief}` : ""}

═══ DESIGN FRAMEWORK (from reference analysis) ═══
${JSON.stringify(framework, null, 2)}

${hasAssets ? `═══ BRAND ASSETS (${selectedAssets.length} images after reference) ═══\n${assetDescriptions}\nThe FIRST image in the conversation is the reference (layout only). Images 2+ are official brand assets — use them exactly as provided.` : `No brand assets provided. Use "${brand.name}" as prominent text with brand colors.`}

═══ CREATIVE RULES ═══
1. Hero visual: 50-70% of canvas, fully visible, not obscured by text.
2. Clear hierarchy: hero → headline → supporting copy → CTA.
3. ALL text must be legible, in the correct language, with proper contrast.
4. Use brand colors prominently — secondary color must be visibly present.
5. Logo (if provided as asset) must be clearly visible with good contrast.
6. No duplicated elements. No clutter. Intentional negative space.
7. Write original, brand-aligned copy — never copy text from the reference or from the brand guidelines verbatim.
8. If brand guidelines specify mandatory elements (tagline, CTA, contact), include them.

Generate the advertisement now.`;

  const userContent: any[] = [
    {
      type: "text",
      text: hasAssets
        ? `Use the FIRST image as structural/layout inspiration only. Do NOT copy its text, logo, or identity. Adapt to ${spec.ratio}. The following ${selectedAssets.length} image(s) are official brand assets.`
        : `Use this reference as structural/layout inspiration only. Adapt to ${spec.ratio}. Follow brand rules exactly.`,
    },
    { type: "image_url", image_url: { url: referenceImageUrl } },
  ];

  for (const asset of selectedAssets) {
    userContent.push({ type: "image_url", image_url: { url: (asset as any).image_url } });
  }

  // Try multiple models with fallback
  const modelPlan = [
    { model: "google/gemini-3.1-flash-image-preview", timeoutMs: 80000 },
    { model: "google/gemini-2.5-flash-image", timeoutMs: 80000 },
    { model: "google/gemini-3-pro-image-preview", timeoutMs: 95000 },
  ];
  const transientStatuses = new Set([500, 502, 503, 504, 529]);

  let sawOverload = false;
  let sawTruncated = false;
  let lastStatus: number | null = null;

  for (const { model, timeoutMs } of modelPlan) {
    console.log(`[${model}] generating...`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
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
    });

    if (!aiResponse.ok) {
      lastStatus = aiResponse.status;
      const errText = await aiResponse.text().catch(() => "");
      console.error(`[${model}] error ${aiResponse.status}:`, errText);

      if (aiResponse.status === 402) throw new Error("CREDITS_EXHAUSTED");
      if (aiResponse.status === 429 || aiResponse.status === 503 || aiResponse.status === 529) {
        sawOverload = true;
        await sleep(2000);
        continue;
      }
      if (transientStatuses.has(aiResponse.status)) {
        await sleep(1200);
        continue;
      }
      break;
    }

    let aiData: any;
    try {
      aiData = await aiResponse.json();
    } catch {
      sawTruncated = true;
      console.warn(`[${model}] truncated response`);
      await sleep(1000);
      continue;
    }

    const imageBase64 = extractImagePayload(aiData);
    const captionText = extractCaptionText(aiData);

    if (imageBase64) return { imageBase64, captionText };

    console.warn(`[${model}] no image in response, trying next model`);
    await sleep(800);
  }

  if (sawOverload) throw new Error("UPSTREAM_OVERLOADED");
  if (sawTruncated) throw new Error("AI_TRUNCATED_RESPONSE");
  if (lastStatus !== null) throw new Error(`AI generation failed (${lastStatus})`);
  throw new Error("NO_IMAGE_GENERATED");
}

// ─── Step 3: Advisory QC (never blocks) ───

async function advisoryQC(
  imageBase64: string,
  brand: any,
  spec: { width: number; height: number; label: string; ratio: string },
  apiKey: string
): Promise<{ score: number; issues: string[] }> {
  try {
    const brandBriefText = getRenderedBrandBrief(brand.brand_brief);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a QC inspector for advertising creatives. Score the creative 0-100 and list any issues. Be fair but thorough.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Inspect this advertisement against brand specs:

Brand: ${brand.name}
Primary: ${brand.primary_color}, Secondary: ${brand.secondary_color}
Required Aspect Ratio: ${spec.ratio}
${brand.brand_voice_rules ? `Voice: ${brand.brand_voice_rules}` : ""}
${brand.negative_prompts ? `Banned: ${brand.negative_prompts}` : ""}
${brandBriefText ? `Guidelines:\n${brandBriefText}` : ""}

Score 0-100. List specific issues.`,
              },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "qc_result",
              description: "Return QC results",
              parameters: {
                type: "object",
                properties: {
                  score: { type: "number", description: "Quality score 0-100" },
                  issues: { type: "array", items: { type: "string" }, description: "List of issues" },
                },
                required: ["score", "issues"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "qc_result" } },
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      await response.text();
      return { score: 70, issues: ["QC unavailable"] };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return { score: 70, issues: ["QC parse failed"] };

    const result = JSON.parse(toolCall.function.arguments);
    return {
      score: Number(result.score) || 70,
      issues: Array.isArray(result.issues) ? result.issues : [],
    };
  } catch (err) {
    console.error("QC error:", err);
    return { score: 70, issues: ["QC timed out"] };
  }
}

// ─── Main handler ───

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { brandId, referenceImageUrl, generationId, outputFormat = "landscape" } = await req.json();
    const spec = FORMAT_SPECS[outputFormat] || FORMAT_SPECS.landscape;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth & credit check
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

    // Fetch brand + assets
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

    // Check for existing framework (reuse on retry)
    let framework: Record<string, unknown>;
    const genRes = generationId
      ? await supabase.from("generations").select("layout_guide").eq("id", generationId).maybeSingle()
      : { data: null, error: null };

    let existingFramework: Record<string, unknown> | null = null;
    if (genRes.data?.layout_guide) {
      try {
        const parsed = typeof genRes.data.layout_guide === "string"
          ? JSON.parse(genRes.data.layout_guide)
          : genRes.data.layout_guide;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) existingFramework = parsed;
      } catch { /* ignore */ }
    }

    if (existingFramework) {
      framework = existingFramework;
      console.log("Reusing stored framework");
    } else {
      await supabase.from("generations").update({ status: "analyzing" }).eq("id", generationId);
      console.log("Step 1: Analyzing reference...");
      try {
        framework = await analyzeFramework(referenceImageUrl, LOVABLE_API_KEY);
        console.log("Framework extracted");
      } catch (err) {
        console.error("Analysis failed:", err);
        await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
        return new Response(
          JSON.stringify({ error: "Failed to analyze reference image layout" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      await supabase.from("generations").update({ layout_guide: JSON.stringify(framework) }).eq("id", generationId);
    }

    // Step 2: Generate
    console.log("Step 2: Generating creative...");
    await supabase.from("generations").update({ status: "generating" }).eq("id", generationId);

    let imageBase64: string;
    let captionText: string;
    try {
      const result = await generateCreative(framework, brand, brandAssets, referenceImageUrl, spec, LOVABLE_API_KEY);
      imageBase64 = result.imageBase64;
      captionText = result.captionText;
    } catch (err: any) {
      console.error("Generation failed:", err);
      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);

      if (err.message === "CREDITS_EXHAUSTED") {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (err.message === "UPSTREAM_OVERLOADED") {
        return new Response(JSON.stringify({
          error: "AI providers are busy. Your analysis was saved — retrying will be faster.",
          retryable: true, retryAfterSeconds: 45,
        }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "45" },
        });
      }
      return new Response(JSON.stringify({ error: err?.message || "Generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Advisory QC (non-blocking)
    console.log("Step 3: Running advisory QC...");
    await supabase.from("generations").update({ status: "quality_checking" }).eq("id", generationId);
    const qcResult = await advisoryQC(imageBase64, brand, spec, LOVABLE_API_KEY);
    console.log("QC result:", JSON.stringify(qcResult));

    // Upload image
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const outputPath = `generations/${generationId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(outputPath, imageBytes, { contentType: "image/png", upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);
      return new Response(JSON.stringify({ error: "Failed to save generated image" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage.from("brand-assets").getPublicUrl(outputPath);

    // Save result
    await supabase.from("generations").update({
      output_image_url: publicUrlData.publicUrl,
      layout_guide: JSON.stringify(framework),
      copywriting: { caption: captionText, qc: { score: qcResult.score, issues: qcResult.issues } },
      status: "completed",
    }).eq("id", generationId);

    // Deduct credit
    if (callerUserId) {
      const { data: currentCredits } = await supabase
        .from("user_credits")
        .select("credits_remaining, credits_used")
        .eq("user_id", callerUserId)
        .single();

      if (currentCredits) {
        await supabase.from("user_credits").update({
          credits_remaining: Math.max(0, currentCredits.credits_remaining - 1),
          credits_used: currentCredits.credits_used + 1,
          updated_at: new Date().toISOString(),
        }).eq("user_id", callerUserId);
      }
    }

    return new Response(JSON.stringify({
      imageUrl: publicUrlData.publicUrl,
      caption: captionText,
      qc: { score: qcResult.score, issues: qcResult.issues },
      framework,
      generationId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("generate-creative OUTER error:", e);
    try {
      const body = await req.clone().json().catch(() => ({}));
      if (body?.generationId) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("generations").update({ status: "failed" }).eq("id", body.generationId);
      }
    } catch { /* cleanup */ }

    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
