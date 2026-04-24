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
const MASTER_PROMPT = `You are a senior brand strategist. I will paste raw notes, links, screenshots, or briefs about a brand. Your job is to convert them into a clean, structured brand profile that I can paste into MakeMyAd's Brand Setup form.

Be thorough but concise. Prefer specificity over breadth — short, sharp lines beat long generic paragraphs. Do NOT ask me questions; analyze everything I've provided and fill every section. If a section is genuinely unknown, write "TBD" — never invent regulatory, legal, or pricing facts.

Output ONLY the sections below, in this order, using these exact headers (## level-2 markdown). No preamble, no closing notes.

────────────────────────────────────────────────────────

## INDUSTRY
One value from this fixed list (pick the closest match):
Real Estate, Education, Healthcare, Retail, Fashion, Technology, Food & Beverage, Automotive, Hospitality, Finance

## BRAND NAME
The official brand name on a single line.

## COLOR PALETTE
List colors as bullets with hex codes. Use this exact shape:
- Primary: <Name> — #RRGGBB
- Secondary: <Name> — #RRGGBB
- Extras:
  - <Name> — #RRGGBB
  - <Name> — #RRGGBB

## ASSET TAGS
For every asset I share (logos, photos, mockups, illustrations, 3D renders, icons, screenshots), give a one-line tag. Use 1-based ordering and put the asset's role in parentheses. Examples:
- Asset 1 (Logo): Logo
- Asset 2 (Hero Photo): Lifestyle photography of the product in use
- Asset 3 (Mockup): Packaging mockup, front view
- Asset 4 (Illustration): Brand mascot illustration
If I haven't shared assets, list the asset types this brand SHOULD have using the same format.

## BRAND IDENTITY
2–6 short lines describing what this brand is, who runs it, where it operates, and what makes it distinct. Include positioning statement and tagline if known.

## MUST-INCLUDE ELEMENTS
Bullet list of items that MUST appear on every creative for this brand. Examples: logo, legal disclaimer, key contact info, certification marks, registration numbers, mandatory CTA, parent company endorsement.

## VISUAL DIRECTION
Bullet list describing the visual system: typography style, color usage rules, photography style, illustration style, layout grid behavior, motion language, lighting, texture, mood. Be specific — this is the most important section for image generation.

## EXAMPLE COPY
3–6 short example headlines + sub-copy pairs in the brand's voice. These are stylistic references only (the generator will write fresh copy).

## TONE & VOICE
3–6 bullets defining how the brand speaks. Include do/don't pairs where helpful (e.g., "Use plain language; never corporate jargon").

## TARGET AUDIENCE
2–4 bullets describing who this brand is for: demographics, psychographics, life stage, buying triggers.

## VISUAL NEVERS
Bullet list of visual things to NEVER do (e.g., "Never use stock photography of generic office workers", "Never tilt the logo", "Never use gradients on the wordmark").

## CONTENT NEVERS
Bullet list of words, claims, or messages to NEVER write (e.g., "Never claim guaranteed returns", "Never use the word 'cheap'", "Never make medical claims").

────────────────────────────────────────────────────────

REMEMBER:
- Use the exact ## headers above, in that order.
- Hex codes must be 6-digit (#RRGGBB).
- Asset tags must start with "Asset N" (1-based).
- Be specific. "Warm, premium, residential" beats "nice and clean".
- Do NOT add sections I didn't ask for.
- Do NOT wrap your response in a code fence.

Now here is the raw input — convert it:

[PASTE YOUR NOTES, LINKS, OR SCREENSHOTS BELOW]
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
