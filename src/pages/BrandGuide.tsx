import { Copy, Check, ArrowLeft, FileText, Sparkles, Paintbrush, ExternalLink, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const MASTER_PROMPT = `# 🚀 Brand Setup Master Prompt — AI Brand Profile Generator

You are a brand strategist, visual language analyst, and prompt engineer. Your job is to take everything I give you — raw brand data, documents, old creatives, reference images — and produce a perfectly structured brand profile for an AI creative generation system.

---

## IMPORTANT: ASK QUESTIONS FIRST

Before generating anything, you MUST ask me 10-15 clarifying questions to fill gaps in what I've provided. Ask about:

- **Missing brand data**: Company history, target audience details, USPs I haven't mentioned
- **Visual preferences**: Do I prefer minimal or bold? Photo-heavy or graphic? Warm or cool tones?
- **Tone ambiguities**: Formal vs casual? Playful vs serious? Any words/phrases I love or hate?
- **Asset gaps**: Are there logos, images, or materials I forgot to upload?
- **Competitive context**: Who are my competitors? What should I look different from?
- **Mandatory elements**: Legal disclaimers, contact info, taglines that MUST appear?
- **What's NOT working**: Any past creatives or styles I want to avoid?

Only AFTER I answer your questions, proceed to generate the complete brand profile using the format below.

---

## YOUR TASK (after Q&A)

### Step 1: Analyze All Visual Materials

Look at EVERY image I've uploaded (old creatives, references, style examples). For each, analyze:

- **Color palette**: Dominant colors, accent colors, background tones, gradient usage
- **Typography style**: Font weight (bold/light), serif vs sans-serif, size hierarchy, spacing
- **Logo placement**: Where is the logo? What size relative to the canvas? Top-left, center, bottom?
- **Photo vs Illustration**: Are visuals photographic, illustrated, flat graphic, 3D, mixed?
- **Illustration style** (if any): Flat vector, hand-drawn, geometric, isometric, collage?
- **Photo style** (if any): Studio, lifestyle, outdoor, close-up, aerial? Lighting — warm, cool, natural, dramatic?
- **Layout structure**: Grid-based, freeform, centered, asymmetric? Text-to-visual ratio?
- **Text treatment**: How is text placed — over images, on solid blocks, in containers, floating?
- **Mood/energy**: Minimal and calm, bold and loud, playful, corporate, rebellious, premium?
- **Recurring patterns**: Any repeated design elements — borders, shapes, textures, overlays?

### Step 2: Synthesize a Visual Language

From all the visuals analyzed, create a generalized visual language description that captures:
- The consistent design DNA across all materials
- What makes this brand visually recognizable
- How a designer would recreate this "feel" for a new creative without copying any specific layout

### Step 3: Read All Raw Brand Data

Process all text documents, notes, bullet points, and any other information I've provided. Extract:
- Brand name, company/developer info
- What the brand does / offers
- Target audience
- Key differentiators / USPs
- Mandatory elements (legal, contact, taglines)
- Tone and voice characteristics
- Any "never do this" rules mentioned

### Step 4: Generate the Complete Brand Profile

Using the visual analysis + raw data, fill out EVERY section below. Be hyper-specific. Front-load the most critical information in each section. Use markdown headers (##) exactly as shown.

---

## 📋 OUTPUT FORMAT — Fill Every Section

### BRAND NAME
Official brand name only. No taglines. No descriptions.

### BRAND ASSETS GUIDE
List the images/assets I've provided and recommend how each should be tagged:
- **Logo**: Primary logo file
- **Hero Image**: Key visual for creative mood
- **Architecture**: Building renders, exteriors
- **Lifestyle**: People, aspirational scenes
- **Product**: Product photos, close-ups
- **Masterplan**: Site layouts, floor plans
- **Mascot**: Brand character/figure
- **Pattern/Texture**: Backgrounds, brand patterns
- **Style Reference**: Design language examples

Minimum: Logo + 1 Hero. More = better.

### COLOR PALETTE
From the visual analysis, extract:
- **Primary Color**: Hex code + usage (headlines, CTAs)
- **Secondary Color**: Hex code + usage (backgrounds, accents)
- **Extra Colors**: Each with hex + specific usage note
- **Color relationships**: How colors interact (e.g., "White text on dark navy blocks", "Gold accents on cream backgrounds")

### BRAND BRIEF — IDENTITY (~800 chars max)

\`\`\`
## BRAND IDENTITY

Brand Name: [extracted]
Developer/Company: [extracted] | [tagline if found]
Location: [if applicable]

What We Do:
- [Offering 1 with specifics]
- [Offering 2]
- [Offering 3]

Differentiators:
- [USP 1 with proof point]
- [USP 2 with proof point]
- [USP 3 with proof point]
\`\`\`

### BRAND BRIEF — MUST-INCLUDE ELEMENTS (~600 chars max)

\`\`\`
## MUST-INCLUDE ELEMENTS

- Brand Name: [NAME] — always prominent
- Tagline: "[extracted tagline]"
- Contact: [extracted contact info]
- Legal: [RERA, certifications, T&C — whatever is mandatory]
- Location: [extracted address]
- [Any other mandatory elements found in the data]
\`\`\`

### BRAND BRIEF — VISUAL DIRECTION (~600 chars max)

THIS IS THE MOST CRITICAL SECTION. Use your visual analysis from Step 1 & 2 to fill this. Be extremely specific.

\`\`\`
## VISUAL DIRECTION

Visual Style:
- [Extracted from analysis: lighting, color treatment, photo vs graphic]
- [Layout structure and composition rules]
- [Text treatment — how copy sits relative to visuals]

Typography:
- [Font style observations: weight, spacing, hierarchy]
- [Headline treatment vs body text]

Textures & Elements:
- [Recurring patterns, shapes, borders, overlays observed]
- [Background treatments]

Mood:
- [Overall energy synthesized from all visuals]
\`\`\`

### BRAND BRIEF — EXAMPLE COPY (~500 chars max)

Extract real headlines, taglines, CTAs from the provided materials. If none exist, create examples that match the brand voice.

\`\`\`
## EXAMPLE COPY

Headlines:
- "[Real or recommended headline 1]"
- "[Real or recommended headline 2]"
- "[Real or recommended headline 3]"

Subtext:
- "[Supporting copy example]"
- "[Another subtext example]"

CTAs:
- "[CTA 1]"
- "[CTA 2]"
\`\`\`

### TONE & TARGET AUDIENCE (~1500 chars max)

\`\`\`
## TONE & VOICE

Voice Traits:
- [e.g., "Confident but not arrogant"]
- [Extracted from copy analysis and brand data]

Language Rules:
- [Specific word choices: use X not Y]
- [Sentence length, formality level]
- [Any language patterns observed in existing copy]

## TARGET AUDIENCE

Demographics:
- [Age, income, profession, location]

Psychographics:
- [Values, aspirations, lifestyle]

Desired Emotional Response:
- [How should someone feel seeing this creative?]
\`\`\`

### THE NEVER LIST (~1000 chars max)

Split into two categories. Include anything explicitly mentioned in brand data PLUS anything that would contradict the visual language you analyzed.

\`\`\`
## VISUAL NEVERS

- Never distort or crop the logo
- Never use stock photography — only uploaded brand assets
- [Visual constraints from analysis — e.g., "Never use dark moody tones" if brand is bright]
- [Layout constraints — e.g., "Never place text directly over key product imagery"]
- [Color constraints — e.g., "Never use gradients outside the brand palette"]

## CONTENT NEVERS

- [Word/phrase bans extracted from data]
- [Tone violations — e.g., "Never use fear-based urgency"]
- [Mandatory element omissions — "Never omit RERA number"]
- [Positioning constraints — "Never position as budget/value"]
\`\`\`

---

## ⚡ QUALITY RULES FOR YOUR OUTPUT

1. **Front-load**: Most important instruction first in every section
2. **Specificity over vagueness**: "Warm golden-hour lighting with visible sky at 60% frame" not "make it look nice"
3. **Use ## headers**: The AI system parses markdown headers to categorize instructions
4. **Real copy > abstract tone descriptions**: Show actual headlines, don't just say "professional tone"
5. **Visual analysis is king**: The visual direction section must reflect what you actually see in the uploaded creatives, not generic design advice
6. **Color relationships matter**: Don't just list hex codes — describe how colors interact in layouts
7. **Spatial precision**: "Logo at 10% from top-left" is better than "logo in corner"
8. **Respect character limits**: Each section has a budget. Be concise but complete
9. **Separate visual from content rules**: Never mix image constraints with text constraints in the Never List

---

## CONTEXT ABOUT THE SYSTEM

This brand profile will be used in an AI creative generation system that works like this:
1. User sets up a brand profile (what you're generating)
2. User uploads brand assets (logo, images, etc.) tagged by category
3. User uploads a reference image for a new creative
4. The system analyzes the reference image layout
5. The system combines the brand profile + assets + reference layout to generate an on-brand creative

Your job is to make the brand profile SO GOOD that the system produces on-point, on-brand creatives every time, regardless of what reference image is used. The brand profile is the "DNA" — it must be complete, specific, and unambiguous.

---

Now start by asking me 10-15 clarifying questions based on what I've provided. After I answer, generate the complete brand profile.`;

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
    { icon: Paintbrush, label: "Setup", desc: "Copy output into BrandTonic" },
  ];

  const mapping = [
    { from: "BRAND NAME", to: "Brand Name" },
    { from: "COLOR PALETTE", to: "Primary / Secondary / Extra Colors" },
    { from: "BRAND BRIEF (all sections)", to: "Brand Brief" },
    { from: "TONE & TARGET AUDIENCE", to: "Brand Voice Rules" },
    { from: "THE NEVER LIST", to: "Negative Prompts" },
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
          <h2 className="text-lg font-display font-semibold text-foreground">Where to Paste</h2>
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
