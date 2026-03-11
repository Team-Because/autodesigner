import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { brandId, referenceImageUrl, generationId } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch brand details
    const { data: brand, error: brandError } = await supabase
      .from("brands")
      .select("*")
      .eq("id", brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: "Brand not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const systemPrompt = `You are an expert brand creative designer. Your job is to analyze a reference advertisement image and recreate it aligned to the given brand identity.

BRAND IDENTITY:
${brandContext}

INSTRUCTIONS:
1. Analyze the reference image's layout, composition, style, and visual framework.
2. Generate a NEW advertisement image that follows the same structural framework but is fully adapted to the brand's colors (${brand.primary_color} primary, ${brand.secondary_color} secondary), tone, and identity.
3. Include the brand name "${brand.name}" prominently in the image.
4. Add appropriate headline text and a call-to-action on the image.
5. The final image must look like a professional, polished advertisement ready for social media or print.
6. Apply any brand guidelines strictly. Respect all exclusions from the "Never" list.

Generate the brand-aligned creative image now.`;

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
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this reference advertisement and generate a new brand-aligned creative based on the brand identity provided. The output should be a complete, professional advertisement image with headline text, brand name, and call-to-action embedded in the image.",
                },
                {
                  type: "image_url",
                  image_url: { url: referenceImageUrl },
                },
              ],
            },
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

      // Update generation as failed
      await supabase
        .from("generations")
        .update({ status: "failed" })
        .eq("id", generationId);

      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const generatedImageBase64 =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const captionText =
      aiData.choices?.[0]?.message?.content || "";

    if (!generatedImageBase64) {
      await supabase
        .from("generations")
        .update({ status: "failed" })
        .eq("id", generationId);

      return new Response(
        JSON.stringify({ error: "No image was generated. Try again." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload generated image to storage
    const base64Data = generatedImageBase64.replace(
      /^data:image\/\w+;base64,/,
      ""
    );
    const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
      c.charCodeAt(0)
    );
    const outputPath = `generations/${generationId}.png`;

    const { error: uploadError } = await supabase.storage
      .from("brand-assets")
      .upload(outputPath, imageBytes, {
        contentType: "image/png",
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      await supabase
        .from("generations")
        .update({ status: "failed" })
        .eq("id", generationId);

      return new Response(
        JSON.stringify({ error: "Failed to save generated image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(outputPath);

    // Update generation record
    await supabase
      .from("generations")
      .update({
        output_image_url: publicUrlData.publicUrl,
        layout_guide: captionText,
        status: "completed",
      })
      .eq("id", generationId);

    return new Response(
      JSON.stringify({
        imageUrl: publicUrlData.publicUrl,
        caption: captionText,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-creative error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
