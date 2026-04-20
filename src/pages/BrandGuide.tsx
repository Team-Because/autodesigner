import { Copy, Check, ArrowLeft, FileText, Sparkles, Paintbrush, ExternalLink, ArrowRight, Wand2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const MASTER_PROMPT = `# 🚀 Brand Setup Master Prompt — AI Brand Profile Generator (v3)

You are a brand strategist, visual language analyst, and prompt engineer. Your job is to take everything I give you — raw brand data, documents, old creatives, reference images — and produce a perfectly structured brand profile for the MakeMyAd creative generation system.

---

## OPTIONAL: ASK QUESTIONS FIRST

If you feel my inputs are too thin to produce a high-quality profile, ask me **5–8** focused clarifying questions BEFORE generating. Otherwise, proceed straight to the output.

Good question topics: target audience specifics, USPs, mandatory legal/contact text (certifications, disclaimers, registration numbers), tone preferences (use-words / avoid-words), visual style references, competitor brands to differentiate from.

If I say "just go" or my input is rich enough, skip Q&A and produce the profile.

---

## STEP 1 — DECLARE THE INDUSTRY (REQUIRED, FIRST)

Pick exactly ONE industry from this list. This drives the asset-tag vocabulary and downstream generation logic. Output it before anything else.

Allowed industries:
\`Real Estate\` · \`Education\` · \`Healthcare\` · \`Retail\` · \`Fashion\` · \`Technology\` · \`Food & Beverage\` · \`Automotive\` · \`Hospitality\` · \`Finance\`

---

## STEP 2 — ANALYZE EVERY VISUAL

For each uploaded image extract: dominant colors (hex), typography weight & style, logo placement, photo vs illustration, mood, layout structure (grid / freeform / centered), text-over-image vs text-on-block, recurring patterns.

Synthesize a generalized **visual DNA** — the consistent design fingerprint across all materials.

---

## STEP 3 — READ ALL RAW DATA

Process docs, notes, briefs. Extract: brand name, what they do, USPs, mandatory elements (legal, contact, taglines), tone signals, "never do this" rules.

---

## STEP 4 — FILL EVERY OUTPUT SECTION

Use markdown headers (\`##\`) **exactly** as shown. Length is flexible — write what the brand actually needs. Specificity beats brevity.

---

## 📋 OUTPUT FORMAT — Copy this whole block into MakeMyAd

\`\`\`
## INDUSTRY
[One value from the allowed list above]

## BRAND NAME
[Official brand name only]

## COLOR PALETTE
- Primary: #RRGGBB — [usage: headlines, CTAs, etc.]
- Secondary: #RRGGBB — [usage: backgrounds, accents]
- Extra:
  - [Name e.g. "Accent Gold"]: #RRGGBB — [usage]
  - [Name]: #RRGGBB — [usage]
- Color relationships: [e.g. "White text on dark navy blocks; gold accent strips on cream"]

## ASSET TAGS
For each asset I uploaded, propose a tag from the chosen industry's vocabulary (see INDUSTRY → TAGS reference below). Format:
- Asset 1 (Logo): Logo
- Asset 2: [tag]
- Asset 3: [tag]
…

## BRAND IDENTITY            ← Be thorough; cover what makes the brand unique
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

## MUST-INCLUDE ELEMENTS     ← Anything that MUST appear on every creative
- Brand name: [NAME] — always prominent
- Tagline: "[tagline, if any]"
- Contact: [phone / email / website / handle — whichever applies]
- Legal / Compliance: [registrations, certifications, disclaimers — only if mandatory for this brand]
- Location: [address or service area, if relevant]

## VISUAL DIRECTION          ← MOST CRITICAL — describe in as much detail as you need
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
- [Overall energy in 1-2 lines]

## EXAMPLE COPY              ← 3-5 strong headlines beat 10 mediocre ones
Headlines (≤8 words each — system enforces this):
- "[Headline 1]"
- "[Headline 2]"
- "[Headline 3]"

Subtext (≤20 words each):
- "[Subcopy 1]"
- "[Subcopy 2]"

CTAs (2-3 words):
- "[CTA 1]"
- "[CTA 2]"

## TONE & VOICE              ← Drives copy moods downstream — be explicit
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

## VISUAL NEVERS             ← image/design constraints only
- Never distort, recolor, or crop the logo
- Never use stock-style imagery — only the uploaded brand assets
- Never [color/style constraint from analysis]
- Never [layout constraint]
- Never [composition constraint]

## CONTENT NEVERS            ← copywriting/messaging constraints only
- Never use words: [list banned words/phrases]
- Never use [tone violation, e.g. "fear-based urgency", "clickbait", "hype"]
- Never omit [mandatory element required for this brand]
- Never position as [off-brand positioning, e.g. cheap / budget / generic / premium — pick what's wrong for THIS brand]
\`\`\`

---

## 🎯 SYSTEM AWARENESS — write your output to fit these rules

The MakeMyAd generator has hard constraints. Don't propose anything it can't honor:

1. **Headlines ≤ 8 words.** Subcopy ≤ 20 words. CTAs 2-3 words. These are real downstream caps for layout integrity.
2. **Reference images = layout blueprints only.** The system will NEVER copy text, names, locations, or pricing from references. Don't write "we'll reuse the photography from the reference".
3. **Logos are force-included** via regex matching. Always present, never altered.
4. **Per-brand mood pool** is auto-derived from your TONE & VOICE + CONTENT NEVERS. Be explicit (use-words / avoid-words) so the right moods get picked.
5. **Output formats:** 1:1 (square), 16:9 (landscape), 9:16 (story), 4:5 (portrait) only.
6. **Length is flexible** — write what the brand actually needs. Specificity beats brevity. The form has no character limits.
7. **VISUAL NEVERS** drive image-prompt constraints. **CONTENT NEVERS** drive copywriting constraints. Keep them separate.

---

## 📚 INDUSTRY → ALLOWED ASSET TAGS reference

Use these EXACT tag names so they paste cleanly into the app's asset gallery:

- **Real Estate**: Logo · Elevation · Interior · Exterior · Amenity · Lifestyle · RERA QR · Pattern/Texture · Render · Other
- **Education**: Logo · Campus · Classroom · Student Life · Faculty · Lab · Library · Playground · Graduation · Sports · Other
- **Healthcare**: Logo · Facility · Medical Equipment · Patient Care · Doctor/Staff · Wellness · Lab · Pharmacy · Hospital Exterior · Therapy · Other
- **Retail**: Logo · Store/Venue · Product · Packaging · Catalogue · Display/Shelf · E-commerce Shot · Window Display · Lifestyle · Banner · Other
- **Fashion**: Logo · Lookbook · On-Model · Flat Lay · Swatch · Fabric Close-up · Collection · Runway · Accessories · Lifestyle · Other
- **Technology**: Logo · Screenshot · UI Mockup · Device Render · Dashboard · Feature Highlight · Mobile View · Desktop View · Icon · Banner · Other
- **Food & Beverage**: Logo · Dish/Menu Item · Packaging · Restaurant/Venue · Ingredient · Plating · Drink · Kitchen · Chef/Staff · Menu Card · Other
- **Automotive**: Logo · Exterior Shot · Interior Shot · Detail/Close-up · On Road · Showroom · Dashboard View · Colour Options · Lifestyle · Banner · Other
- **Hospitality**: Logo · Room/Suite · Amenity · Dining · Spa/Wellness · Pool · Lobby · Aerial View · Guest Experience · Lifestyle · Other
- **Finance**: Logo · Data Visualization · Office/Branch · Card/Product · Mobile Banking · Investment Chart · Team Photo · Lifestyle · Banner · Report · Other

If nothing fits, use \`Other: <short description>\`.

---

## ✅ QUALITY RULES

1. **Front-load** the most important info in every section.
2. **Specificity beats vagueness** — "Warm golden-hour light, sky visible at 60% frame" beats "make it nice".
3. **Real copy > abstract tone words** — show actual headlines.
4. **Visual analysis is king** — VISUAL DIRECTION must reflect what you actually saw, not generic design talk.
5. **Spatial precision** — "Logo at 10% from top-left" beats "logo in corner".
6. **Length is flexible** — no hard character limits; write what the brand needs.
7. **Never fabricate** legal/registration numbers, contact info, certifications, or taglines that aren't in the source.
8. **Keep VISUAL NEVERS and CONTENT NEVERS strictly separate.**

---

Now produce the brand profile. Either ask 5-8 sharp questions first, or — if you have enough — go straight to the OUTPUT FORMAT block above.`;

export default function BrandGuide() {
  const navigate = useNavigate();
  const [pageCopied, setPageCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(MASTER_PROMPT);
    setPageCopied(true);
    setTimeout(() => setPageCopied(false), 3000);
  };

  const steps = [
    { icon: FileText, label: "Gather", desc: "Brand docs, logos, old creatives" },
    { icon: Sparkles, label: "Prompt", desc: "Paste in Claude + attach files" },
    { icon: Wand2, label: "Paste & Parse", desc: "One textarea in MakeMyAd auto-fills everything" },
  ];

  const mapping = [
    { from: "## INDUSTRY", to: "Industry dropdown" },
    { from: "## BRAND NAME", to: "Brand Name" },
    { from: "## COLOR PALETTE", to: "Primary / Secondary / Extra Colors" },
    { from: "## ASSET TAGS", to: "Per-asset tag dropdowns" },
    { from: "## BRAND IDENTITY", to: "Brief — Identity" },
    { from: "## MUST-INCLUDE ELEMENTS", to: "Brief — Must-Include" },
    { from: "## VISUAL DIRECTION", to: "Brief — Visual Direction" },
    { from: "## EXAMPLE COPY", to: "Brief — Example Copy" },
    { from: "## TONE & VOICE + ## TARGET AUDIENCE", to: "Brand Voice Rules" },
    { from: "## VISUAL NEVERS", to: "Never List → Visual" },
    { from: "## CONTENT NEVERS", to: "Never List → Content" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="space-y-1">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <h1 className="text-2xl font-display font-bold text-foreground">Brand Setup Guide</h1>
        <p className="text-sm text-muted-foreground">Create your brand profile in 3 steps</p>
      </div>

      {/* 3-Step Strip */}
      <div className="grid grid-cols-3 gap-4">
        {steps.map((step, i) => (
          <div key={step.label} className="text-center space-y-2">
            <div className="mx-auto h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <step.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                <span className="text-primary mr-1">{i + 1}.</span>{step.label}
              </p>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Master Prompt */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-display font-semibold text-foreground">Master Prompt</h2>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCopyPrompt} className="gap-1.5">
                {pageCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {pageCopied ? "Copied!" : "Copy"}
              </Button>
              <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1.5">
                  Open Claude <ExternalLink className="h-3 w-3" />
                </Button>
              </a>
            </div>
          </div>
          <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
            {MASTER_PROMPT}
          </pre>
        </CardContent>
      </Card>

      {/* Where to Paste */}
      <Card className="border-border/50">
        <CardContent className="pt-6 space-y-3">
          <h2 className="text-lg font-display font-semibold text-foreground">Where each section lands</h2>
          <p className="text-xs text-muted-foreground">Tip: in the brand form, use <strong>Paste & Parse</strong> — drop the whole Claude output into one textarea and we'll route every section automatically.</p>
          <div className="divide-y divide-border">
            {mapping.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5">
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded text-foreground shrink-0">{item.from}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground font-medium">{item.to}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex justify-center gap-3">
        <Button onClick={handleCopyPrompt} variant="outline" className="gap-2">
          {pageCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {pageCopied ? "Copied!" : "Copy Prompt"}
        </Button>
        <Button onClick={() => navigate("/brands/new")} className="gap-2">
          <Paintbrush className="h-4 w-4" /> Create a Brand
        </Button>
      </div>
    </div>
  );
}
