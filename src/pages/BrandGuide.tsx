import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Copy, Check, Download, Sparkles, ClipboardPaste, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

/**
 * Master Prompt v3 — industry-agnostic.
 *
 * IMPORTANT: The output schema below MUST stay aligned with
 * `src/lib/brandParser.ts` (parseMasterOutput). The parser keys on these
 * exact `## SECTION` headers (case-insensitive) and on per-asset bullets
 * "Asset N (Label): tag".
 *
 * Sections consumed by the parser:
 *   ## INDUSTRY
 *   ## BRAND NAME
 *   ## COLOR PALETTE   (Primary / Secondary / Extras: bullets with #hex)
 *   ## ASSET TAGS      ("Asset 1 (Logo): Logo", "Asset 2: Hero Photo", …)
 *   ## BRAND IDENTITY
 *   ## MUST-INCLUDE ELEMENTS
 *   ## VISUAL DIRECTION
 *   ## EXAMPLE COPY
 *   ## TONE & VOICE
 *   ## TARGET AUDIENCE
 *   ## VISUAL NEVERS
 *   ## CONTENT NEVERS
 */
const MASTER_PROMPT = `🚀 MakeMyAd Brand Setup — Master Prompt (v4)

You are a brand strategist, visual language analyst, and prompt engineer. Take everything I give you — raw notes, docs, websites, old creatives, reference images, screenshots — and produce a perfectly structured brand profile for the MakeMyAd creative generation system.

────────────────────────────────────────────────────────
OPTIONAL — ASK QUESTIONS FIRST
────────────────────────────────────────────────────────
If my inputs are too thin to produce a high-quality profile, ask me 5–8 sharp clarifying questions BEFORE generating. Good topics: target audience specifics, USPs with proof points, mandatory legal/contact text (RERA, certifications, disclaimers, registration numbers), tone preferences (use-words / avoid-words), visual style references, competitors to differentiate from.
If I say "just go" or my input is rich enough, skip Q&A and produce the profile.

────────────────────────────────────────────────────────
STEP 1 — DECLARE THE INDUSTRY (REQUIRED, FIRST)
────────────────────────────────────────────────────────
Pick exactly ONE from this list. This drives the asset-tag vocabulary and downstream generation logic.
Real Estate · Education · Healthcare · Retail · Fashion · Technology · Food & Beverage · Automotive · Hospitality · Finance

────────────────────────────────────────────────────────
STEP 2 — ANALYZE EVERY VISUAL
────────────────────────────────────────────────────────
For each uploaded image extract: dominant colors (hex), typography weight & style, logo placement, photo vs illustration vs 3D, mood, layout structure (grid / freeform / centered), text-over-image vs text-on-block, recurring patterns. Synthesize a generalized visual DNA — the consistent design fingerprint across all materials.

────────────────────────────────────────────────────────
STEP 3 — READ ALL RAW DATA
────────────────────────────────────────────────────────
Process docs, notes, briefs, websites. Extract: brand name, what they do, USPs with proof points, mandatory elements (legal, contact, taglines), tone signals, "never do this" rules.

────────────────────────────────────────────────────────
STEP 4 — FILL EVERY OUTPUT SECTION
────────────────────────────────────────────────────────
Use the markdown headers (##) below EXACTLY as shown, in this exact order. No preamble, no closing notes, no code fence around the whole output. Length is flexible — write what the brand actually needs. Specificity beats brevity. If a fact is genuinely unknown, write "TBD" — NEVER fabricate legal/registration numbers, certifications, taglines, or contact info.

📋 OUTPUT FORMAT — copy this whole block into MakeMyAd Paste & Parse

## INDUSTRY
[One value from the allowed list above]

## BRAND NAME
[Official brand name only — single line]

## COLOR PALETTE
- Primary: <Name> — #RRGGBB — [usage: headlines, CTAs, etc.]
- Secondary: <Name> — #RRGGBB — [usage: backgrounds, accents]
- Extras:
  - <Name e.g. "Accent Gold"> — #RRGGBB — [usage]
  - <Name> — #RRGGBB — [usage]
- Color relationships: [e.g. "White text on dark navy blocks; gold accent strips on cream"]

## ASSET TAGS
For each asset I uploaded, propose a tag from the chosen industry's vocabulary (see INDUSTRY → TAGS reference below). Use 1-based ordering and put the asset's role in parentheses. If I haven't shared assets, list the asset types this brand SHOULD have using the same format.
- Asset 1 (Logo): Logo
- Asset 2 (Hero Photo): [tag from industry vocab]
- Asset 3 (Mockup): [tag from industry vocab]
…

## BRAND IDENTITY
Brand: [official name]
Parent / Company: [parent company or umbrella brand, if any] | [tagline]
Location / Market: [city, region, or "global" — if relevant]
What we do:
- [Core offering 1 with specifics]
- [Core offering 2]
- [Core offering 3]
Differentiators:
- [USP 1 with proof point]
- [USP 2 with proof point]
- [USP 3 with proof point]

## MUST-INCLUDE ELEMENTS
- Brand name: [NAME] — always prominent
- Tagline: "[tagline, if any]"
- Contact: [phone / email / website / handle — whichever applies]
- Legal / Compliance: [registrations, certifications, disclaimers — only if mandatory for this brand]
- Location: [address or service area, if relevant]

## VISUAL DIRECTION   ← MOST CRITICAL — describe in as much detail as needed
Visual Style:
- [Lighting / color treatment / photo vs graphic vs 3D vs illustration]
- [Layout structure & composition rules]
- [How copy sits relative to visuals]
Typography:
- [Weight, hierarchy, spacing observations]
- [Headline vs body treatment]
Textures & Elements:
- [Recurring patterns, shapes, borders, overlays]
- [Background treatments]
Mood:
- [Overall energy in 1–2 lines]

## EXAMPLE COPY
Headlines (≤8 words each — system enforces this):
- "[Headline 1]"
- "[Headline 2]"
- "[Headline 3]"
Subtext (≤20 words each):
- "[Subcopy 1]"
- "[Subcopy 2]"
CTAs (2–3 words):
- "[CTA 1]"
- "[CTA 2]"

## TONE & VOICE
Voice Traits:
- [e.g. "Confident, never arrogant"]
- [e.g. "Warm but precise"]
Use words: [comma-separated list of preferred vocabulary]
Avoid words: [comma-separated list of banned vocabulary]
Sentence pattern: [short & punchy / flowing & poetic / direct & informative]

## TARGET AUDIENCE
Demographics: [age, income, role/profession, location]
Psychographics: [values, aspirations, lifestyle, motivations]
Desired emotional response: [how should they feel after seeing the ad?]

## VISUAL NEVERS   ← image/design constraints only
- Never distort, recolor, or crop the logo
- Never use stock-style imagery — only the uploaded brand assets
- Never [color/style constraint from analysis]
- Never [layout constraint]
- Never [composition constraint]

## CONTENT NEVERS   ← copywriting/messaging constraints only
- Never use words: [list banned words/phrases]
- Never use [tone violation, e.g. "fear-based urgency", "clickbait", "hype"]
- Never omit [mandatory element required for this brand]
- Never position as [off-brand positioning — pick what's wrong for THIS brand]

────────────────────────────────────────────────────────
🎯 SYSTEM AWARENESS — write your output to fit these rules
────────────────────────────────────────────────────────
The MakeMyAd generator has hard constraints. Don't propose anything it can't honor:
- Headlines ≤ 8 words. Subcopy ≤ 20 words. CTAs 2–3 words. Real downstream caps for layout integrity.
- Reference images = layout blueprints only. The system will NEVER copy text, names, locations, or pricing from references. Don't write "we'll reuse the photography from the reference".
- Logos are force-included via regex matching. Always present, never altered.
- Per-brand mood pool is auto-derived from your TONE & VOICE + CONTENT NEVERS. Be explicit (use-words / avoid-words) so the right moods get picked.
- Output formats: 1:1 (square), 16:9 (landscape), 9:16 (story), 4:5 (portrait) only.
- VISUAL NEVERS drive image-prompt constraints. CONTENT NEVERS drive copywriting constraints. Keep them strictly separate.

────────────────────────────────────────────────────────
📚 INDUSTRY → ALLOWED ASSET TAGS reference
────────────────────────────────────────────────────────
Use these EXACT tag names so they paste cleanly into the app's asset gallery:

Real Estate: Logo · Elevation · Interior · Exterior · Amenity · Lifestyle · RERA QR · Pattern/Texture · Render · Other
Education: Logo · Campus · Classroom · Student Life · Faculty · Lab · Library · Playground · Graduation · Sports · Other
Healthcare: Logo · Facility · Medical Equipment · Patient Care · Doctor/Staff · Wellness · Lab · Pharmacy · Hospital Exterior · Therapy · Other
Retail: Logo · Store/Venue · Product · Packaging · Catalogue · Display/Shelf · E-commerce Shot · Window Display · Lifestyle · Banner · Other
Fashion: Logo · Lookbook · On-Model · Flat Lay · Swatch · Fabric Close-up · Collection · Runway · Accessories · Lifestyle · Other
Technology: Logo · Screenshot · UI Mockup · Device Render · Dashboard · Feature Highlight · Mobile View · Desktop View · Icon · Banner · Other
Food & Beverage: Logo · Dish/Menu Item · Packaging · Restaurant/Venue · Ingredient · Plating · Drink · Kitchen · Chef/Staff · Menu Card · Other
Automotive: Logo · Exterior Shot · Interior Shot · Detail/Close-up · On Road · Showroom · Dashboard View · Colour Options · Lifestyle · Banner · Other
Hospitality: Logo · Room/Suite · Amenity · Dining · Spa/Wellness · Pool · Lobby · Aerial View · Guest Experience · Lifestyle · Other
Finance: Logo · Data Visualization · Office/Branch · Card/Product · Mobile Banking · Investment Chart · Team Photo · Lifestyle · Banner · Report · Other

If nothing fits, use: Other: <short description>

────────────────────────────────────────────────────────
✅ QUALITY RULES
────────────────────────────────────────────────────────
- Front-load the most important info in every section.
- Specificity beats vagueness — "Warm golden-hour light, sky visible at 60% frame" beats "make it nice".
- Real copy > abstract tone words — show actual headlines.
- Visual analysis is king — VISUAL DIRECTION must reflect what you actually saw, not generic design talk.
- Spatial precision — "Logo at 10% from top-left" beats "logo in corner".
- Length is flexible — no hard character limits; write what the brand needs.
- Never fabricate legal/registration numbers, contact info, certifications, or taglines that aren't in the source.
- Hex codes must be 6-digit (#RRGGBB). Asset tags must start with "Asset N" (1-based).
- Use the exact ## headers above, in that order. Do NOT wrap the output in a code fence.

Now produce the brand profile. Either ask 5–8 sharp questions first, or — if you have enough — go straight to the OUTPUT FORMAT block above.

[PASTE YOUR NOTES, LINKS, DOCS, OR SCREENSHOTS BELOW]
`;

export default function BrandGuide() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(MASTER_PROMPT);
    setCopied(true);
    toast.success("Master Prompt copied — paste it into Claude or ChatGPT");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([MASTER_PROMPT], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "makemyad-master-prompt.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container max-w-5xl py-8 space-y-8">
      {/* Hero */}
      <div className="space-y-3">
        <Badge variant="secondary" className="rounded-full">
          <Sparkles className="h-3 w-3 mr-1" /> Brand Setup Guide
        </Badge>
        <h1 className="text-4xl font-display font-bold tracking-tight">
          Set up a brand in 3 steps
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Use the Master Prompt below to turn raw notes into a clean brand profile,
          then paste the result into MakeMyAd's Paste &amp; Parse wizard.
        </p>
      </div>

      {/* Steps */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <Badge className="w-fit rounded-full">Step 1</Badge>
            <CardTitle className="text-lg">Gather data</CardTitle>
            <CardDescription>
              Logos, brand book PDFs, website URL, sample posts, screenshots, raw notes.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Badge className="w-fit rounded-full">Step 2</Badge>
            <CardTitle className="text-lg">Run the Master Prompt</CardTitle>
            <CardDescription>
              Paste it into Claude or ChatGPT, attach your assets, and let it produce a
              clean structured brief.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Badge className="w-fit rounded-full">Step 3</Badge>
            <CardTitle className="text-lg">Paste &amp; Parse</CardTitle>
            <CardDescription>
              Open a new brand → paste the LLM's output into the Paste &amp; Parse wizard.
              Review, then save.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Master Prompt */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              The Master Prompt
            </CardTitle>
            <CardDescription>
              Industry-agnostic. Outputs the exact structure MakeMyAd's parser understands.
            </CardDescription>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> .md
            </Button>
            <Button size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 mr-1.5" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy prompt
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={MASTER_PROMPT}
            readOnly
            className="font-mono text-xs h-[480px] resize-none bg-muted/40"
          />
        </CardContent>
      </Card>

      {/* What it produces */}
      <Card>
        <CardHeader>
          <CardTitle>What the prompt produces</CardTitle>
          <CardDescription>
            These are the sections the LLM will return — all of them map directly into
            MakeMyAd brand fields.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ["## INDUSTRY", "Industry select"],
              ["## BRAND NAME", "Brand name field"],
              ["## COLOR PALETTE", "Primary, secondary + extras"],
              ["## ASSET TAGS", "Per-asset labels (1-based)"],
              ["## BRAND IDENTITY", "Brief — Identity"],
              ["## MUST-INCLUDE ELEMENTS", "Brief — Must-Include"],
              ["## VISUAL DIRECTION", "Brief — Visual Direction"],
              ["## EXAMPLE COPY", "Brief — Example Copy"],
              ["## TONE & VOICE", "Voice rules"],
              ["## TARGET AUDIENCE", "Voice rules"],
              ["## VISUAL NEVERS", "Negative prompts (visual)"],
              ["## CONTENT NEVERS", "Negative prompts (content)"],
            ].map(([header, target]) => (
              <div
                key={header}
                className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
              >
                <code className="text-xs font-mono text-foreground">{header}</code>
                <span className="text-xs text-muted-foreground">→ {target}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Next step */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-4 w-4 text-primary" />
              Ready to paste?
            </CardTitle>
            <CardDescription>
              Open the Brand Hub, create a new brand, and use the Paste &amp; Parse wizard
              at the top of the form.
            </CardDescription>
          </div>
          <Button asChild>
            <Link to="/brands">
              Go to Brands <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground text-center">
        Tip: Claude 3.5 Sonnet and GPT-4o both handle this prompt well. Attach images
        (logo, references) directly to the chat for the most accurate asset tagging.
      </p>
    </div>
  );
}
