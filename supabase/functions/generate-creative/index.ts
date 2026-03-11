import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brandId, referenceImageUrl, generationId, outputFormat = "landscape" } = await req.json();

    const formatSpecs: Record<string, { width: number; height: number; label: string }> = {
      landscape: { width: 1920, height: 1080, label: "landscape (1920×1080)" },
      square: { width: 1080, height: 1080, label: "square (1080×1080)" },
      story: { width: 1080, height: 1920, label: "portrait/story (1080×1920)" },
    };
    const spec = formatSpecs[outputFormat] || formatSpecs.landscape;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch brand details and assets in parallel
    const [brandRes, assetsRes] = await Promise.all([
      supabase.from("brands").select("*").eq("id", brandId).single(),
      supabase.from("brand_assets").select("image_url, label").eq("brand_id", brandId),
    ]);

    const brand = brandRes.data;
    if (brandRes.error || !brand) {
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brandAssets = assetsRes.data || [];

    // Build the prompt from brand data
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

    // Describe brand assets for the prompt
    const assetDescriptions = brandAssets
      .map((a: any, i: number) => `  - Image ${i + 1}: ${a.label || "Brand asset"}`)
      .join("\n");

    const systemPrompt = `You are an expert brand creative designer. Your job is to analyze a reference advertisement image and recreate it aligned to the given brand identity.

BRAND IDENTITY:
${brandContext}

OUTPUT FORMAT: ${spec.label} — The generated image MUST be exactly ${spec.width}×${spec.height} pixels in ${spec.label} orientation.

${hasAssets ? `BRAND ASSETS: ${brandAssets.length} brand images are provided after the reference image. These include logos, product photos, building shots, mascots, etc.:
${assetDescriptions}

You MUST incorporate these brand assets into the generated creative. Use logos exactly as provided — do NOT redraw or reimagine them. Product photos, building shots, and other assets should be naturally integrated into the composition.` : `No brand assets were provided. Use the brand name "${brand.name}" as text instead of a logo.`}

INSTRUCTIONS:
1. Analyze the reference image's layout, composition, style, and visual framework.
2. Generate a NEW advertisement image in ${spec.label} format (${spec.width}×${spec.height}) that follows the same structural framework but is fully adapted to the brand's colors (${brand.primary_color} primary, ${brand.secondary_color} secondary), tone, and identity.
3. ${hasAssets ? "Incorporate the provided brand assets (logos, photos, etc.) naturally into the creative. Place logos prominently." : `Include the brand name "${brand.name}" prominently in the image.`}
4. Add appropriate headline text and a call-to-action on the image.
5. The final image must look like a professional, polished advertisement ready for social media or print.
6. Apply any brand guidelines strictly. Respect all exclusions from the "Never" list.
7. Adapt the layout appropriately for the ${spec.label} format — reflow text and elements to fit the dimensions naturally.

Generate the brand-aligned creative image now.`;

    // Build message content: reference image first, then all brand assets
    const userContent: any[] = [
      {
        type: "text",
        text: hasAssets
          ? `The FIRST image is the reference advertisement to analyze for layout and structure. The following ${brandAssets.length} image(s) are official brand assets (logos, product photos, mascots, etc.) — use them in the generated creative. Generate a new brand-aligned creative.`
          : "Analyze this reference advertisement and generate a new brand-aligned creative based on the brand identity provided.",
      },
      {
        type: "image_url",
        image_url: { url: referenceImageUrl },
      },
    ];

    // Add all brand assets as images
    for (const asset of brandAssets) {
      userContent.push({
        type: "image_url",
        image_url: { url: (asset as any).image_url },
      });
    }

    // Call AI Gateway with image generation model
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
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
      console.error("AI gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);

      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedImageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const captionText = aiData.choices?.[0]?.message?.content || "";

    if (!generatedImageBase64) {
      await supabase.from("generations").update({ status: "failed" }).eq("id", generationId);

      return new Response(
        JSON.stringify({ error: "No image was generated. Try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload generated image to storage
    const base64Data = generatedImageBase64.replace(/^data:image\/\w+;base64,/, "");
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
      .update({ output_image_url: publicUrlData.publicUrl, layout_guide: captionText, status: "completed" })
      .eq("id", generationId);

    return new Response(
      JSON.stringify({ imageUrl: publicUrlData.publicUrl, caption: captionText }),
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
