import { BookOpen, Copy, Check, ArrowLeft, Palette, Image, Type, MessageSquare, Ban, Zap, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
      <pre className="bg-muted/50 border border-border rounded-lg p-4 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
        {text}
      </pre>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
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

export default function BrandGuide() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      {/* Header */}
      <div className="space-y-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 -ml-2 text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Brand Setup Guide</h1>
            <p className="text-sm text-muted-foreground">Everything you need to create a perfect brand profile</p>
          </div>
        </div>
      </div>

      {/* Overview */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6 space-y-3">
          <p className="text-sm text-foreground/90 leading-relaxed">
            Your brand profile is the <strong>single source of truth</strong> that powers every AI-generated creative.
            The more structured and specific your inputs, the more accurate and on-brand the outputs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-[10px]">~2500 chars for Brand Brief</Badge>
            <Badge variant="outline" className="text-[10px]">~1500 chars for Tone & Audience</Badge>
            <Badge variant="outline" className="text-[10px]">~1000 chars for Never List</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Front-load the most important information in each field — the AI prioritises content that appears first.
          </p>
        </CardContent>
      </Card>

      {/* Section 1: Brand Name */}
      <Section icon={Type} title="Brand Name" badge="Required" defaultOpen>
        <p>Keep it concise. This appears on every generated creative as a reference label.</p>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Use the official brand name, not abbreviations</li>
          <li>Include the project/product name if applicable (e.g., "ANANTARA ALORA")</li>
          <li>Avoid taglines or descriptions here — those go in the Brand Brief</li>
        </ul>
      </Section>

      {/* Section 2: Brand Assets */}
      <Section icon={Image} title="Brand Assets" badge="Important">
        <p>Upload all visual materials the AI should reference. <strong>Tagging is critical</strong> — it tells the AI how to use each image.</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { tag: "Logo", desc: "Primary logo — preserved exactly, never altered" },
            { tag: "Hero Image", desc: "Key visual that sets the creative mood" },
            { tag: "Architecture", desc: "Building renders, elevations, exteriors" },
            { tag: "Lifestyle", desc: "People, aspirational scenes, amenity shots" },
            { tag: "Product", desc: "Product photos, close-ups, detail shots" },
            { tag: "Masterplan", desc: "Site layouts, floor plans, maps" },
            { tag: "Mascot", desc: "Brand character or illustrated figure" },
            { tag: "Pattern/Texture", desc: "Backgrounds, brand patterns, textures" },
          ].map((item) => (
            <div key={item.tag} className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs font-semibold text-foreground">{item.tag}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          💡 Upload at least a <strong>Logo</strong> and one <strong>Hero Image</strong> for best results. More assets = more creative variety.
        </p>
      </Section>

      {/* Section 3: Color Palette */}
      <Section icon={Palette} title="Color Palette" badge="Required">
        <p>Define your full color system. The AI uses these to ensure on-brand color usage.</p>
        <div className="space-y-2">
          <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
            <p className="text-xs font-semibold">Primary Color</p>
            <p className="text-[11px] text-muted-foreground">Your dominant brand color — used for headlines, CTAs, key elements</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
            <p className="text-xs font-semibold">Secondary Color</p>
            <p className="text-[11px] text-muted-foreground">Supporting color — used for backgrounds, accents, secondary elements</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
            <p className="text-xs font-semibold">Extra Colors (via "Add Color")</p>
            <p className="text-[11px] text-muted-foreground">Add accent, text, background, and CTA colors with descriptive names. Include usage notes in the name (e.g., "Gold — headings only", "Dark Charcoal — body text")</p>
          </div>
        </div>
      </Section>

      {/* Section 4: Brand Brief — Identity */}
      <Section icon={FileText} title="Brand Brief — Identity" badge="~800 chars">
        <p>This is the <strong>who, what, where</strong> of your brand. Include project facts, location, developer name, and key differentiators.</p>
        <CopyBlock
          label="Template — Real Estate"
          text={`## BRAND IDENTITY

Brand Name: [PROJECT NAME]
Developer: [DEVELOPER NAME] | [Tagline]
Location: [Area], [City]

What We Do:
- [Key offering 1, e.g., "Luxury 3 BHK Residences from 2,594 sq.ft"]
- [Key offering 2, e.g., "Exclusive 4 BHK Penthouses from 5,116 sq.ft"]
- [Key offering 3, e.g., "Pet-friendly community with curated lifestyle"]
- [Amenities, e.g., "Pool, Gymnasium, Kids play area"]
- [Status, e.g., "Show apartment ready for viewing"]

Differentiators:
- [USP 1, e.g., "Largest 3 BHK in the area — 2,594 sq.ft"]
- [USP 2, e.g., "Only developer with X certification"]
- [USP 3, e.g., "Zero additional costs — No Stamp Duty, No GST"]`}
        />
        <CopyBlock
          label="Template — Product / Consumer Brand"
          text={`## BRAND IDENTITY

Brand Name: [BRAND NAME]
Tagline: "[Your tagline]"

What We Do:
- [Core product/service 1]
- [Core product/service 2]
- [Distribution: B2B / B2C / both]

Differentiators:
- [USP 1, e.g., "In-house manufacturing, end-to-end quality control"]
- [USP 2, e.g., "Category trendsetters, not just manufacturers"]
- [Market position, e.g., "#1 in Bihar for stainless steel cutlery"]`}
        />
      </Section>

      {/* Section 5: Brand Brief — Must-Include */}
      <Section icon={FileText} title="Brand Brief — Must-Include Elements" badge="~600 chars">
        <p>Mandatory text that <strong>must appear</strong> on every creative. The AI treats these as non-negotiable.</p>
        <CopyBlock
          label="Template — Real Estate"
          text={`## MUST-INCLUDE ELEMENTS

- Project Name: [PROJECT NAME] — always prominent
- Developer: [Developer Name] with logo
- Tagline: "[Your tagline]"
- RERA: [RERA NUMBER] | [RERA website]
- Contact: [PHONE NUMBER]
- Location: [Full address / landmark]
- Legal: "T&C Apply" in footer
- Amenity mentions: [Pool, Gym, etc. — lifestyle selling points]`}
        />
        <CopyBlock
          label="Template — Product Brand"
          text={`## MUST-INCLUDE ELEMENTS

- Brand Name: [BRAND NAME] — always prominent
- Tagline: "[Your tagline]"
- Contact: [Phone / Website / Social handle]
- Certifications: [ISO, BIS, etc.]
- Product range mention: [e.g., "Available in 50+ designs"]`}
        />
      </Section>

      {/* Section 6: Brand Brief — Visual Direction */}
      <Section icon={FileText} title="Brand Brief — Visual Direction" badge="~600 chars">
        <p>Tell the AI <strong>how creatives should look</strong> — mood, lighting, textures, composition style.</p>
        <CopyBlock
          label="Template"
          text={`## VISUAL DIRECTION

Photography Style:
- [e.g., "Warm golden-hour lighting, natural tones"]
- [e.g., "Wide-angle architectural shots showing scale"]
- [e.g., "Lifestyle shots with aspirational families"]

Layout & Composition:
- [e.g., "Clean, minimal layouts — generous white space"]
- [e.g., "Building renders at 60% frame, sky visible"]
- [e.g., "Logo top-left, CTA bottom-right, contact in footer"]

Textures & Materials:
- [e.g., "Subtle marble or concrete textures as overlays"]
- [e.g., "Premium matte finishes, avoid glossy effects"]

Mood:
- [e.g., "Serene, premium, nature-led — not flashy or aggressive"]`}
        />
      </Section>

      {/* Section 7: Brand Brief — Example Copy */}
      <Section icon={FileText} title="Brand Brief — Example Copy" badge="~500 chars">
        <p>Give the AI <strong>sample headlines, CTAs, and taglines</strong> to learn your voice and style.</p>
        <CopyBlock
          label="Template"
          text={`## EXAMPLE COPY

Headlines:
- "[e.g., Where Nature Meets Luxury]"
- "[e.g., The Largest 3 BHK in Science Park]"
- "[e.g., Live the Life You Deserve]"

Subtext:
- "[e.g., Spacious residences designed for modern families]"
- "[e.g., Premium amenities. Uncompromised privacy.]"

CTAs:
- "[e.g., Book Your Private Viewing]"
- "[e.g., Visit the Show Apartment Today]"
- "[e.g., Call 8306 333 777]"`}
        />
      </Section>

      {/* Section 8: Tone & Target Audience */}
      <Section icon={MessageSquare} title="Tone & Target Audience" badge="~1500 chars">
        <p>Define your brand's <strong>voice personality</strong> and <strong>who you're talking to</strong>.</p>
        <CopyBlock
          label="Template"
          text={`## TONE & VOICE

Voice Traits:
- [e.g., "Confident but not arrogant"]
- [e.g., "Premium and aspirational, never salesy"]
- [e.g., "Warm and inviting, grounded in nature"]

Language Style:
- [e.g., "Use 'curated' not 'selected', 'residences' not 'flats'"]
- [e.g., "Short, impactful sentences — max 12 words per line"]

## TARGET AUDIENCE

Demographics:
- [e.g., "Affluent homebuyers, 35-55 years"]
- [e.g., "HNI families upgrading from 2 BHK to 3/4 BHK"]

Psychographics:
- [e.g., "Value privacy, open spaces, and nature"]
- [e.g., "Pet owners seeking pet-friendly communities"]

Desired Emotional Response:
- [e.g., "Feel that this is THE premium choice in the area"]
- [e.g., "Sense of exclusivity and belonging"]`}
        />
      </Section>

      {/* Section 9: The Never List */}
      <Section icon={Ban} title="The Never List" badge="~1000 chars">
        <p>Critical constraints the AI must <strong>never violate</strong>. Split into two clear categories for best results.</p>
        <CopyBlock
          label="Template"
          text={`## VISUAL NEVERS

- Never distort or crop the logo
- Never alter building render proportions or colors
- Never use stock photography — only uploaded brand assets
- Never use dark/moody color schemes
- Never place text over the building render's key features
- Never use gradients that clash with brand palette

## CONTENT NEVERS

- Never use the word "cheap", "affordable", or "budget"
- Never use fear-based urgency ("Hurry!", "Last chance!")
- Never make unverifiable ROI or rental return claims
- Never omit [RERA number / legal disclaimers]
- Never omit contact number [PHONE]
- Never omit location [ADDRESS]
- Never position as mid-segment or value housing
- Never use ALL CAPS for body text (headlines OK)`}
        />
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
            { tip: "Front-load critical info", desc: "The AI prioritises content that appears first in each field. Put your most important rules at the top." },
            { tip: "Use markdown headers (##)", desc: "Structure your brief with ## headers. The AI parses these to separate visual from textual constraints." },
            { tip: "Be specific, not vague", desc: "'Warm golden-hour lighting with visible sky' beats 'make it look nice'. Precision = consistency." },
            { tip: "Tag every asset", desc: "An untagged image is harder for the AI to use correctly. Always select a category from the dropdown." },
            { tip: "Test with a generation", desc: "After setting up your brand, run a test generation immediately. Review the output and refine your brief based on what's missing." },
            { tip: "Separate Visual from Content rules", desc: "In the Never List, use ## VISUAL NEVERS and ## CONTENT NEVERS headers. This prevents the AI from confusing image rules with text rules." },
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
      <div className="flex justify-center pt-4">
        <Button onClick={() => navigate("/brands/new")} className="gap-2">
          <Palette className="h-4 w-4" /> Create a Brand Now
        </Button>
      </div>
    </div>
  );
}
