import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { StructuredBrandProfile } from "@/lib/brandProfileSerializer";

interface Props {
  profile: StructuredBrandProfile;
  onChange: (profile: StructuredBrandProfile) => void;
}

function updateSection(
  profile: StructuredBrandProfile,
  section: string,
  field: string,
  value: string
): StructuredBrandProfile {
  const sectionVal = (profile as any)[section];
  if (typeof sectionVal === "string") return profile;
  return { ...profile, [section]: { ...sectionVal, [field]: value } };
}

export default function BrandProfileSections({ profile, onChange }: Props) {
  const set = (section: string, field: string, value: string) => {
    onChange(updateSection(profile, section, field, value));
  };

  return (
    <Accordion type="multiple" defaultValue={["identity", "mandatory"]} className="space-y-2">
      {/* A — Identity */}
      <AccordionItem value="identity" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">A. Brand Identity</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">One-Liner</Label>
            <Input value={profile.identity.oneLiner} onChange={e => set("identity", "oneLiner", e.target.value)} placeholder="Single sentence — what you are and who you serve" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">What You Do (3–5 bullets)</Label>
            <Textarea value={profile.identity.offerings} onChange={e => set("identity", "offerings", e.target.value)} placeholder="- Core offering #1&#10;- Core offering #2" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Differentiators</Label>
            <Textarea value={profile.identity.differentiators} onChange={e => set("identity", "differentiators", e.target.value)} placeholder="What sets you apart" rows={2} />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* B — Mandatory Elements */}
      <AccordionItem value="mandatory" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">B. Mandatory Elements</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">Text that MUST appear on every creative.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Brand Name (as displayed)</Label>
              <Input value={profile.mandatoryElements.brandNameDisplay} onChange={e => set("mandatoryElements", "brandNameDisplay", e.target.value)} placeholder='e.g., "SWS Shivashish World School"' />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tagline / Slogan</Label>
              <Input value={profile.mandatoryElements.tagline} onChange={e => set("mandatoryElements", "tagline", e.target.value)} placeholder='e.g., "Future-Ready Learning"' />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Default CTA</Label>
              <Input value={profile.mandatoryElements.defaultCta} onChange={e => set("mandatoryElements", "defaultCta", e.target.value)} placeholder='e.g., "Admissions Open | Enrol Now"' />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Information</Label>
              <Input value={profile.mandatoryElements.contactInfo} onChange={e => set("mandatoryElements", "contactInfo", e.target.value)} placeholder="+91 98xxx | www.example.com" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Legal / Compliance Text</Label>
            <Input value={profile.mandatoryElements.legalText} onChange={e => set("mandatoryElements", "legalText", e.target.value)} placeholder='e.g., "CBSE Affiliated | RERA No. XXXXX"' />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Other Mandatory Text</Label>
            <Input value={profile.mandatoryElements.otherMandatory} onChange={e => set("mandatoryElements", "otherMandatory", e.target.value)} placeholder="Certifications, hashtags, etc." />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* C — Voice & Messaging */}
      <AccordionItem value="voice" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">C. Brand Voice & Messaging</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Voice Traits (3–6 adjectives)</Label>
            <Input value={profile.voiceMessaging.voiceTraits} onChange={e => set("voiceMessaging", "voiceTraits", e.target.value)} placeholder="Modern, Trustworthy, Clear, Aspirational, Warm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Messaging Pillars (recurring themes)</Label>
            <Textarea value={profile.voiceMessaging.messagingPillars} onChange={e => set("voiceMessaging", "messagingPillars", e.target.value)} placeholder="1. Admissions Open — a confident first step&#10;2. Skill-focused learning" rows={3} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Words / Phrases TO USE</Label>
              <Textarea value={profile.voiceMessaging.wordsToUse} onChange={e => set("voiceMessaging", "wordsToUse", e.target.value)} placeholder="Future-ready, Growth, Pathway" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Words / Phrases TO AVOID</Label>
              <Textarea value={profile.voiceMessaging.wordsToAvoid} onChange={e => set("voiceMessaging", "wordsToAvoid", e.target.value)} placeholder="Guaranteed results, No.1 in the world" rows={2} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* D — Target Audience */}
      <AccordionItem value="audience" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">D. Target Audience</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Primary Audience</Label>
            <Textarea value={profile.targetAudience.primary} onChange={e => set("targetAudience", "primary", e.target.value)} placeholder="Who, age, demographics, psychographics" rows={2} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Secondary Audience</Label>
            <Input value={profile.targetAudience.secondary} onChange={e => set("targetAudience", "secondary", e.target.value)} placeholder="If any" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Desired Emotional Response</Label>
            <Input value={profile.targetAudience.emotionalResponse} onChange={e => set("targetAudience", "emotionalResponse", e.target.value)} placeholder="Confident, inspired, reassured" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* E — Visual Style */}
      <AccordionItem value="visual" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">E. Visual Style & Rules</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Mood</Label>
              <Input value={profile.visualStyle.mood} onChange={e => set("visualStyle", "mood", e.target.value)} placeholder="Clean, modern, aspirational" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Lighting</Label>
              <Input value={profile.visualStyle.lighting} onChange={e => set("visualStyle", "lighting", e.target.value)} placeholder="Warm natural light, bright and airy" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Photography Style</Label>
              <Input value={profile.visualStyle.photography} onChange={e => set("visualStyle", "photography", e.target.value)} placeholder="Real people, candid moments" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Layout</Label>
              <Input value={profile.visualStyle.layout} onChange={e => set("visualStyle", "layout", e.target.value)} placeholder="Minimal with generous whitespace" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Textures</Label>
            <Input value={profile.visualStyle.textures} onChange={e => set("visualStyle", "textures", e.target.value)} placeholder="Subtle gradients allowed, no heavy patterns" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Composition Rules</Label>
            <Textarea value={profile.visualStyle.compositionRules} onChange={e => set("visualStyle", "compositionRules", e.target.value)} placeholder="Headline hierarchy: Main > Support > CTA" rows={3} />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* F — Do's & Don'ts */}
      <AccordionItem value="dosdonts" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">F. Do's & Don'ts</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-success">Visual Do's</Label>
              <Textarea value={profile.dosAndDonts.visualDos} onChange={e => set("dosAndDonts", "visualDos", e.target.value)} placeholder="- Use warm, natural lighting&#10;- Maintain premium composition" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-destructive">Visual Don'ts</Label>
              <Textarea value={profile.dosAndDonts.visualDonts} onChange={e => set("dosAndDonts", "visualDonts", e.target.value)} placeholder="- No generic crests or emblems&#10;- No overcrowded layouts" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-success">Content Do's</Label>
              <Textarea value={profile.dosAndDonts.contentDos} onChange={e => set("dosAndDonts", "contentDos", e.target.value)} placeholder="- Always include grade range&#10;- Use approved CTAs only" rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-destructive">Content Don'ts</Label>
              <Textarea value={profile.dosAndDonts.contentDonts} onChange={e => set("dosAndDonts", "contentDonts", e.target.value)} placeholder="- Never use fear-based urgency&#10;- No exaggerated claims" rows={3} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* G — Color Palette Notes */}
      <AccordionItem value="colornotes" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">G. Color Usage Notes</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">Colors are set above via pickers. Add usage rules here.</p>
          <Textarea value={profile.colorNotes} onChange={e => onChange({ ...profile, colorNotes: e.target.value })} placeholder='e.g., "Red only for sale campaigns, never as primary background"' rows={3} />
        </AccordionContent>
      </AccordionItem>

      {/* H — Asset Usage Rules */}
      <AccordionItem value="assetrules" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-display font-semibold">H. Asset Usage Rules</AccordionTrigger>
        <AccordionContent className="space-y-3 pb-4">
          <p className="text-xs text-muted-foreground">Assets are uploaded above. Add placement/usage rules here.</p>
          <Textarea value={profile.assetRules} onChange={e => onChange({ ...profile, assetRules: e.target.value })} placeholder='e.g., "Logo must never be stretched. Product photos maintain original proportions."' rows={3} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
