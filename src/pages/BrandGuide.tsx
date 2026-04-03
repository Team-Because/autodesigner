import { BookOpen, Copy, Check, ArrowLeft, Zap, Upload, MessageSquare, Paintbrush, ClipboardList, Sparkles, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      {label && <p className="text-xs font-medium text-muted-foreground mb-1.5">{label}</p>}
      <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto max-h-[400px] overflow-y-auto">
        {text}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
        <span className="text-[10px] ml-1">{copied ? "Copied" : "Copy"}</span>
      </Button>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/50">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base font-display">{title}</CardTitle>
                {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
              </div>
              <div className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}>
                ▾
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4 text-sm text-foreground/90 leading-relaxed">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

const MASTER_PROMPT = `# 🚀 Brand Setup Master Prompt — One-Shot Brand Profile Generator

You are a brand strategist, visual language analyst, and prompt engineer. Your job is to take everything I give you — raw brand data, documents, old creatives, reference images — and produce a perfectly structured brand profile for an AI creative generation system. Do NOT ask me questions. Analyze everything I've provided and generate the complete profile in one shot.

---

## YOUR TASK

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

Now analyze everything I've provided and generate the complete brand profile. No questions. Just output.`;

export default function BrandGuide() {
  const navigate = useNavigate();
  const [pageCopied, setPageCopied] = useState(false);

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(MASTER_PROMPT);
    setPageCopied(true);
    setTimeout(() => setPageCopied(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground">Brand Setup Guide</h1>
              <p className="text-sm text-muted-foreground">Create a perfect brand profile in 3 minutes using Claude</p>
            </div>
          </div>
        </div>
      </div>

      {/* How It Works — Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 space-y-4">
          <h2 className="text-lg font-display font-semibold text-foreground">How It Works</h2>
          <p className="text-sm text-foreground/90 leading-relaxed">
            Instead of filling out every field manually, you use <strong>Claude AI</strong> to analyze your brand materials and generate a perfectly structured brand profile. One prompt, one click — done.
          </p>
          <div className="grid gap-3">
            {[
              { step: "1", title: "Gather your materials", desc: "Raw brand data (docs, notes, bullet points) + old creatives or reference images" },
              { step: "2", title: "Open Claude & paste the Master Prompt", desc: "Copy the prompt below and paste it into Claude (claude.ai)" },
              { step: "3", title: "Upload everything & hit Enter", desc: "Claude analyzes visuals + data and outputs a complete brand profile" },
              { step: "4", title: "Copy sections into BrandTonic", desc: "Paste each section into the corresponding field in your brand setup" },
            ].map((item) => (
              <div key={item.step} className="flex gap-3 items-start">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-primary">{item.step}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Gather Materials */}
      <Section icon={ClipboardList} title="Step 1 — Gather Your Materials" badge="Before you start" defaultOpen>
        <p>Collect everything you have about your brand. The more you give Claude, the better the output.</p>
        
        <div className="space-y-3">
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-2">
            <p className="text-sm font-semibold text-foreground">📄 Raw Brand Data</p>
            <p className="text-xs text-muted-foreground">Any of these work — you don't need all of them:</p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 ml-2">
              <li>Brand documents, pitch decks, presentations</li>
              <li>Website copy, about pages, brochure text</li>
              <li>Unstructured notes, bullet points, WhatsApp messages</li>
              <li>Product descriptions, pricing info, USPs</li>
              <li>Legal/compliance text (RERA, certifications, disclaimers)</li>
              <li>Contact details, social handles, addresses</li>
            </ul>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 border border-border/50 space-y-2">
            <p className="text-sm font-semibold text-foreground">🎨 Visual Materials (Critical!)</p>
            <p className="text-xs text-muted-foreground">Upload at least 3-5 images for best results:</p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 ml-2">
              <li><strong>Old creatives</strong> — social media posts, ads, banners you've made before</li>
              <li><strong>Reference images</strong> — designs from other brands whose visual style you admire</li>
              <li><strong>Logo files</strong> — your primary logo in high resolution</li>
              <li><strong>Brand guideline PDFs</strong> — if you have existing guidelines</li>
              <li><strong>Product/building photos</strong> — your actual visual assets</li>
            </ul>
            <p className="text-xs text-primary font-medium mt-2">
              💡 Claude will analyze these to extract your visual language — colors, typography, layout patterns, mood.
            </p>
          </div>
        </div>
      </Section>

      {/* Step 2: The Master Prompt */}
      <Section icon={Sparkles} title="Step 2 — Copy the Master Prompt" badge="The magic" defaultOpen>
        <p>
          This single prompt tells Claude to analyze everything you upload and generate a complete brand profile — no back-and-forth needed.
        </p>
        
        <div className="flex items-center gap-2 mb-2">
          <Button onClick={handleCopyPrompt} className="gap-2">
            {pageCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {pageCopied ? "Copied!" : "Copy Master Prompt"}
          </Button>
          <a href="https://claude.ai" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              Open Claude <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>

        <CopyBlock label="Master Prompt — Copy this entire block" text={MASTER_PROMPT} />
      </Section>

      {/* Step 3: How to Use in Claude */}
      <Section icon={Upload} title="Step 3 — Upload & Generate in Claude" badge="3 minutes">
        <p>Here's exactly what to do in Claude:</p>

        <div className="space-y-3">
          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <p className="text-sm font-semibold text-foreground mb-2">In the Claude chat window:</p>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-2 ml-2">
              <li><strong>Paste the Master Prompt</strong> — this goes first in the message box</li>
              <li><strong>Attach your raw data files</strong> — drag & drop documents, PDFs, text files</li>
              <li><strong>Attach your visual materials</strong> — drag & drop 3-10 old creatives, references, or brand images</li>
              <li><strong>Hit Enter</strong> — Claude will analyze everything and output the full brand profile</li>
            </ol>
          </div>

          <div className="bg-secondary/10 rounded-lg p-4 border border-secondary/30">
            <p className="text-sm font-semibold text-foreground mb-1">⚡ Pro tip: One message, everything attached</p>
            <p className="text-xs text-muted-foreground">
              Paste the prompt + attach ALL files in a single message. Don't send the prompt first and files later — Claude works best when it sees everything at once.
            </p>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
            <p className="text-sm font-semibold text-foreground mb-2">What Claude will output:</p>
            <ul className="list-disc list-inside text-xs text-muted-foreground space-y-1 ml-2">
              <li><strong>Brand Name</strong> → paste into the "Brand Name" field</li>
              <li><strong>Color Palette</strong> → set Primary, Secondary, and Extra Colors</li>
              <li><strong>Brand Brief sections</strong> → paste each into the corresponding Brand Brief field</li>
              <li><strong>Tone & Target Audience</strong> → paste into "Brand Voice Rules"</li>
              <li><strong>The Never List</strong> → paste into "Negative Prompts"</li>
              <li><strong>Asset tagging recommendations</strong> → use when uploading assets to BrandTonic</li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Step 4: Paste into BrandTonic */}
      <Section icon={Paintbrush} title="Step 4 — Paste into BrandTonic" badge="Final step">
        <p>Take Claude's output and paste each section into the matching field in your brand setup form.</p>

        <div className="space-y-2">
          {[
            { from: "BRAND NAME", to: "Brand Name field", note: "Just the name, no tagline" },
            { from: "COLOR PALETTE → Primary", to: "Primary Color picker", note: "Use the hex code" },
            { from: "COLOR PALETTE → Secondary", to: "Secondary Color picker", note: "Use the hex code" },
            { from: "COLOR PALETTE → Extra Colors", to: "'Add Color' button", note: "Add each with name + hex" },
            { from: "BRAND BRIEF (Identity + Must-Include + Visual Direction + Example Copy)", to: "Brand Brief textarea", note: "Paste all four sections together" },
            { from: "TONE & TARGET AUDIENCE", to: "Brand Voice Rules textarea", note: "Full tone section" },
            { from: "THE NEVER LIST", to: "Negative Prompts textarea", note: "Both Visual + Content Nevers" },
          ].map((item, i) => (
            <div key={i} className="bg-muted/30 rounded-lg p-3 border border-border/50 flex items-start gap-3">
              <span className="text-xs font-bold text-primary mt-0.5 shrink-0">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-xs text-foreground">
                  <span className="font-mono text-[11px] bg-accent/50 px-1 py-0.5 rounded">{item.from}</span>
                  {" → "}
                  <span className="font-semibold">{item.to}</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{item.note}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          💡 After pasting, upload your logo and key images as Brand Assets with the tags Claude recommended.
        </p>
      </Section>

      {/* Pro Tips */}
      <Card className="border-secondary/30 bg-secondary/5">
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-secondary" />
            <CardTitle className="text-base font-display">Pro Tips</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {[
            { tip: "More visuals = better analysis", desc: "Upload 5-10 old creatives or references. Claude extracts your visual DNA — typography, colors, layout patterns, mood — from these images." },
            { tip: "Include what you DON'T want", desc: "If certain creatives didn't work, upload those too and tell Claude 'I don't want this style.' Negative examples are powerful." },
            { tip: "Mix old creatives + aspirational references", desc: "Upload both your existing work AND designs from brands you admire. Claude will blend your identity with the style you aspire to." },
            { tip: "Test immediately after setup", desc: "Create a brand → go to Studio → upload a reference image → generate. Review the output and refine your brand brief based on what's off." },
            { tip: "Iterate the brief, not the prompt", desc: "If outputs aren't perfect, tweak the Brand Brief and Negative Prompts fields directly in BrandTonic. Small changes compound into big improvements." },
            { tip: "One brand = one visual system", desc: "If your brand has very different visual needs (e.g., interior vs exterior), consider creating separate brand profiles for each." },
          ].map((item, i) => (
            <div key={i} className="flex gap-2.5">
              <span className="text-secondary font-bold text-xs mt-0.5 shrink-0">{i + 1}.</span>
              <div>
                <p className="font-medium text-foreground text-sm">{item.tip}</p>
                <p className="text-muted-foreground text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex justify-center gap-3 pt-4">
        <Button onClick={handleCopyPrompt} variant="outline" className="gap-2">
          {pageCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {pageCopied ? "Copied!" : "Copy Master Prompt"}
        </Button>
        <Button onClick={() => navigate("/brands/new")} className="gap-2">
          <Paintbrush className="h-4 w-4" /> Create a Brand
        </Button>
      </div>
    </div>
  );
}
