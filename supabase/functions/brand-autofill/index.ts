// Brand Autofill — multimodal AI analysis of logo + references + optional URL.
// Returns structured JSON the client merges into the BrandForm.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const INDUSTRIES = [
  "Real Estate", "Education", "Healthcare", "Retail", "Fashion",
  "Technology", "Food & Beverage", "Automotive", "Hospitality", "Finance",
];

// Mirrors BrandForm.tsx INDUSTRY_CATEGORIES. Kept here so the AI knows the
// allowed tag vocabulary per industry. "Other: ..." is always allowed.
const INDUSTRY_CATEGORIES: Record<string, string[]> = {
  "Real Estate": ["Logo", "Elevation", "Interior", "Exterior", "Amenity", "Lifestyle", "RERA QR", "Pattern/Texture", "Render"],
  "Education": ["Logo", "Campus", "Classroom", "Student Life", "Faculty", "Lab", "Library", "Playground", "Graduation", "Sports"],
  "Healthcare": ["Logo", "Facility", "Medical Equipment", "Patient Care", "Doctor/Staff", "Wellness", "Lab", "Pharmacy", "Hospital Exterior", "Therapy"],
  "Retail": ["Logo", "Store/Venue", "Product", "Packaging", "Catalogue", "Display/Shelf", "E-commerce Shot", "Window Display", "Lifestyle", "Banner"],
  "Fashion": ["Logo", "Lookbook", "On-Model", "Flat Lay", "Swatch", "Fabric Close-up", "Collection", "Runway", "Accessories", "Lifestyle"],
  "Technology": ["Logo", "Screenshot", "UI Mockup", "Device Render", "Dashboard", "Feature Highlight", "Mobile View", "Desktop View", "Icon", "Banner"],
  "Food & Beverage": ["Logo", "Dish/Menu Item", "Packaging", "Restaurant/Venue", "Ingredient", "Plating", "Drink", "Kitchen", "Chef/Staff", "Menu Card"],
  "Automotive": ["Logo", "Exterior Shot", "Interior Shot", "Detail/Close-up", "On Road", "Showroom", "Dashboard View", "Colour Options", "Lifestyle", "Banner"],
  "Hospitality": ["Logo", "Room/Suite", "Amenity", "Dining", "Spa/Wellness", "Pool", "Lobby", "Aerial View", "Guest Experience", "Lifestyle"],
  "Finance": ["Logo", "Data Visualization", "Office/Branch", "Card/Product", "Mobile Banking", "Investment Chart", "Team Photo", "Lifestyle", "Banner", "Report"],
};

// ─── Lightweight URL scraping ───
// Pulls title/description/og tags + first H1/H2 + visible body text snippet.
// We deliberately avoid heavy HTML parsers — regex is fine for meta tags.
async function scrapeUrl(url: string): Promise<{
  title: string;
  description: string;
  ogImage: string | null;
  bodyText: string;
} | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MakeMyAdBot/1.0)" },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const pick = (re: RegExp) => {
      const m = html.match(re);
      return m ? m[1].trim() : "";
    };

    const title = pick(/<title[^>]*>([^<]+)<\/title>/i);
    const description =
      pick(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      pick(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
    let ogImage =
      pick(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      pick(/<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
    if (ogImage && !ogImage.startsWith("http")) {
      try {
        ogImage = new URL(ogImage, url).toString();
      } catch {
        ogImage = null;
      }
    }

    // Headlines & first 2000 chars of visible text — strip scripts/styles/tags.
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
    const headlines: string[] = [];
    const headRe = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
    let m: RegExpExecArray | null;
    while ((m = headRe.exec(stripped)) !== null && headlines.length < 8) {
      const txt = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (txt) headlines.push(txt);
    }
    const bodyText = stripped
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    return {
      title,
      description,
      ogImage,
      bodyText: [
        headlines.length ? `Headlines: ${headlines.join(" | ")}` : "",
        bodyText,
      ].filter(Boolean).join("\n\n").slice(0, 12000),
    };
  } catch (e) {
    console.warn("scrapeUrl failed:", e);
    return null;
  }
}

// Convert a remote image URL to a data URL the AI can ingest. Caps at ~5MB.
async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    let mime = "image/png";
    if (buf[0] === 0xFF && buf[1] === 0xD8) mime = "image/jpeg";
    else if (buf[0] === 0x89 && buf[1] === 0x50) mime = "image/png";
    else if (buf[0] === 0x52 && buf[1] === 0x49) mime = "image/webp";
    else if (buf[0] === 0x47 && buf[1] === 0x49) mime = "image/gif";
    else return null;
    let bin = "";
    const chunk = 8192;
    for (let i = 0; i < buf.length; i += chunk) {
      bin += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

const TOOL_SCHEMA = {
  type: "function" as const,
  function: {
    name: "fill_brand_profile",
    description: "Fill out a structured brand profile based on the provided assets and website data.",
    parameters: {
      type: "object",
      properties: {
        industry: {
          type: "string",
          enum: INDUSTRIES,
          description: "Best-fit industry from the allowed list.",
        },
        primary_color: { type: "string", description: "Hex color #RRGGBB. Most prominent brand color (logo / accent)." },
        secondary_color: { type: "string", description: "Hex color #RRGGBB. Supporting / background color." },
        extra_colors: {
          type: "array",
          maxItems: 6,
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Short name e.g. 'Accent Gold'." },
              hex: { type: "string", description: "#RRGGBB" },
            },
            required: ["name", "hex"],
            additionalProperties: false,
          },
        },
        brief_identity: { type: "string", description: "BRAND IDENTITY section — name, what they do, USPs. Be thorough but focused — quality over length." },
        brief_mandatory: { type: "string", description: "MUST-INCLUDE ELEMENTS — tagline, contact, legal, etc. Empty string if unknown." },
        brief_visual: { type: "string", description: "VISUAL DIRECTION — mood, lighting, photo style, layout, typography. CRITICAL section — describe in as much detail as needed." },
        brief_copy: { type: "string", description: "EXAMPLE COPY — sample headlines, subtext, CTAs. 3-5 strong examples beat 10 mediocre ones." },
        brand_voice_rules: { type: "string", description: "Tone, demographics, target audience traits, use-words / avoid-words. Be thorough but focused." },
        negative_prompts: { type: "string", description: "What the brand should NEVER do (visual + content). Empty string if unknown. Use ## VISUAL NEVERS and ## CONTENT NEVERS headers if you have both." },
        asset_tags: {
          type: "array",
          description: "One entry per uploaded asset, in the same order received. Each tag MUST be from the chosen industry's category list, or 'Other: <description>'.",
          items: {
            type: "object",
            properties: {
              index: { type: "number" },
              tag: { type: "string", description: "Category tag matching the chosen industry's allowed list, or 'Other: short description'." },
              reasoning: { type: "string", description: "1-line why this tag." },
            },
            required: ["index", "tag"],
            additionalProperties: false,
          },
        },
        confidence: {
          type: "string",
          enum: ["high", "medium", "low"],
          description: "How confident the AI is. Low = user should review heavily.",
        },
      },
      required: [
        "industry", "primary_color", "secondary_color",
        "brief_identity", "brief_visual", "asset_tags", "confidence",
      ],
      additionalProperties: false,
    },
  },
};

interface AnalyzeBody {
  logo_url?: string;
  reference_urls?: string[];
  website_url?: string;
  brand_name_hint?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: require a valid JWT (we deploy with verify_jwt = true).
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: AnalyzeBody = await req.json().catch(() => ({}));
    const refUrls = (body.reference_urls || []).slice(0, 6);

    if (!body.logo_url && refUrls.length === 0 && !body.website_url) {
      return new Response(
        JSON.stringify({ error: "Provide at least one of: logo, references, or website URL." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ─── Scrape URL (best effort) ───
    let scraped: Awaited<ReturnType<typeof scrapeUrl>> = null;
    if (body.website_url) {
      scraped = await scrapeUrl(body.website_url);
    }

    // ─── Build multimodal content array ───
    const userContent: Array<Record<string, unknown>> = [];

    const intro: string[] = [
      "Analyze the provided brand materials and produce a structured brand profile by calling the `fill_brand_profile` tool.",
      "",
      `Brand name hint: ${body.brand_name_hint || "(not provided)"}`,
      "",
      "MATERIALS PROVIDED:",
    ];
    if (body.logo_url) intro.push("- Image 1: Brand logo (use this for primary color extraction).");
    if (refUrls.length) intro.push(`- Images ${body.logo_url ? 2 : 1}–${(body.logo_url ? 1 : 0) + refUrls.length}: Reference creatives / brand visuals.`);
    if (scraped?.ogImage) intro.push(`- Final image: Website OG/preview screenshot.`);
    if (scraped) {
      intro.push("");
      intro.push("WEBSITE DATA:");
      if (scraped.title) intro.push(`Title: ${scraped.title}`);
      if (scraped.description) intro.push(`Meta: ${scraped.description}`);
      if (scraped.bodyText) intro.push(`Content snippet:\n${scraped.bodyText}`);
    }

    intro.push("");
    intro.push("RULES FOR THE BRIEF:");
    intro.push("- Detect the industry FIRST from the visuals and copy. Choose from: " + INDUSTRIES.join(", ") + ".");
    intro.push("- For asset_tags, the `tag` field MUST be one of the allowed categories for the chosen industry (listed below), or 'Other: <short description>' if nothing fits.");
    intro.push("- The first asset is the LOGO if provided — tag it 'Logo'.");
    intro.push("- VISUAL DIRECTION is the MOST important brief section — be hyper-specific about lighting, mood, photo vs graphic style, layout structure, typography weight.");
    intro.push("- Extract REAL hex codes from the logo & references. Don't invent generic colors.");
    intro.push("- Mark `confidence: low` if you had to guess most fields; the user will review.");
    intro.push("- Never invent a tagline, RERA number, or contact info — leave brief_mandatory empty if not in the source materials.");
    intro.push("");
    intro.push("INDUSTRY → ALLOWED ASSET TAGS:");
    for (const [ind, cats] of Object.entries(INDUSTRY_CATEGORIES)) {
      intro.push(`  ${ind}: ${cats.join(", ")}, Other`);
    }

    userContent.push({ type: "text", text: intro.join("\n") });

    // Convert all images to data URLs (skip silently if any fail).
    const allImageUrls: string[] = [];
    if (body.logo_url) allImageUrls.push(body.logo_url);
    allImageUrls.push(...refUrls);
    if (scraped?.ogImage) allImageUrls.push(scraped.ogImage);

    let attachedCount = 0;
    for (const url of allImageUrls) {
      const dataUrl = await urlToDataUrl(url);
      if (dataUrl) {
        userContent.push({ type: "image_url", image_url: { url: dataUrl } });
        attachedCount++;
      }
    }
    if (attachedCount === 0 && !scraped) {
      return new Response(
        JSON.stringify({ error: "Could not load any of the provided images or website." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[brand-autofill] images=${attachedCount}, scraped=${!!scraped}, url=${body.website_url || "—"}`);

    // ─── Call Lovable AI (Gemini 2.5 Pro for best multimodal reasoning) ───
    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content:
              "You are a senior brand strategist + visual analyst. You analyze logos, reference creatives, and website data to produce a complete, accurate brand profile by calling the provided tool. Always respond by calling `fill_brand_profile` — never with plain text.",
          },
          { role: "user", content: userContent },
        ],
        tools: [TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "fill_brand_profile" } },
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text().catch(() => "");
      console.error("AI gateway error", aiRes.status, t);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted — add funds to your Lovable AI workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI analysis failed." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool_call in response:", JSON.stringify(aiData).slice(0, 500));
      return new Response(JSON.stringify({ error: "AI did not return a structured profile." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("Tool args not JSON:", e);
      return new Response(JSON.stringify({ error: "AI returned malformed data." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No char clamping — let the form receive the full LLM output.
    const asStr = (v: unknown): string => (typeof v === "string" ? v : "");
    const result = {
      industry: asStr(parsed.industry),
      primary_color: asStr(parsed.primary_color),
      secondary_color: asStr(parsed.secondary_color),
      extra_colors: Array.isArray(parsed.extra_colors) ? parsed.extra_colors.slice(0, 6) : [],
      brief_identity: asStr(parsed.brief_identity),
      brief_mandatory: asStr(parsed.brief_mandatory),
      brief_visual: asStr(parsed.brief_visual),
      brief_copy: asStr(parsed.brief_copy),
      brand_voice_rules: asStr(parsed.brand_voice_rules),
      negative_prompts: asStr(parsed.negative_prompts),
      asset_tags: Array.isArray(parsed.asset_tags) ? parsed.asset_tags : [],
      confidence: typeof parsed.confidence === "string" ? parsed.confidence : "medium",
      website_meta: scraped ? { title: scraped.title, description: scraped.description } : null,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("brand-autofill error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
