import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { StructuredBrandProfile } from "@/lib/brandProfileSerializer";

interface Props {
  profile: StructuredBrandProfile;
  onChange: (profile: StructuredBrandProfile) => void;
}

const FIELDS: {
  key: keyof StructuredBrandProfile;
  label: string;
  placeholder: string;
  hint: string;
  rows: number;
}[] = [
  {
    key: "brandIdentity",
    label: "Brand Identity",
    hint: "Who you are, what you do, and what makes you different.",
    placeholder:
      "Premium pre-school chain for ages 2–6.\nFocused on play-based, Montessori-inspired learning.\nDifferentiators: 25+ years legacy, 200+ centres, bilingual curriculum.",
    rows: 4,
  },
  {
    key: "mustInclude",
    label: "Must-Include Elements",
    hint: "Text that MUST appear on every creative — brand name, tagline, CTA, contact, legal.",
    placeholder:
      'Brand Name: Shanti Juniors\nTagline: "Where Learning Meets Joy"\nCTA: Admissions Open | Enrol Now\nContact: +91 98xxx xxxxx | www.example.com\nLegal: CBSE Affiliated',
    rows: 5,
  },
  {
    key: "visualDirection",
    label: "Visual Direction",
    hint: "Mood, lighting, photography style, layout preferences, textures — everything visual.",
    placeholder:
      "Mood: Warm, joyful, premium\nLighting: Bright natural light, soft shadows\nPhotography: Real children, candid play moments\nLayout: Clean with generous whitespace, headline > subtext > CTA hierarchy\nTextures: Subtle watercolor washes allowed, no heavy patterns",
    rows: 5,
  },
  {
    key: "voiceAndTone",
    label: "Voice & Tone",
    hint: "How the brand speaks, who it speaks to, desired emotional response, key phrases.",
    placeholder:
      "Voice: Warm, trustworthy, aspirational, clear\nAudience: Parents aged 25–40, urban, education-focused\nDesired response: Confident and reassured\nUse: Future-ready, nurturing, growth\nAvoid: Guaranteed results, #1 in the world",
    rows: 5,
  },
  {
    key: "dos",
    label: "Do's — Always",
    hint: "What to always do — both visual and content rules.",
    placeholder:
      "- Use warm, natural lighting in every visual\n- Maintain premium composition with clear focal point\n- Always include the grade/age range\n- Use approved CTAs only",
    rows: 4,
  },
  {
    key: "donts",
    label: "Don'ts — Never",
    hint: "What to never do — these become strict negative constraints for the AI.",
    placeholder:
      "- No generic stock photos or clip art\n- No overcrowded layouts\n- Never use fear-based urgency\n- No exaggerated claims or superlatives",
    rows: 4,
  },
  {
    key: "colorNotes",
    label: "Color Usage Notes",
    hint: "Rules beyond hex codes — when to use which color, restrictions.",
    placeholder:
      'Red only for sale campaigns, never as primary background.\nGold accent for premium communications only.',
    rows: 3,
  },
  {
    key: "referenceNotes",
    label: "Additional Notes",
    hint: "Anything else — asset rules, seasonal guidelines, special instructions.",
    placeholder:
      'Logo must never be stretched. Product photos maintain original proportions.\nDuring festival season, incorporate traditional motifs subtly.',
    rows: 3,
  },
];

export default function BrandProfileSections({ profile, onChange }: Props) {
  return (
    <div className="space-y-5">
      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-sm font-semibold font-display">{field.label}</Label>
          <p className="text-xs text-muted-foreground">{field.hint}</p>
          <Textarea
            value={profile[field.key]}
            onChange={(e) => onChange({ ...profile, [field.key]: e.target.value })}
            placeholder={field.placeholder}
            rows={field.rows}
            className="text-sm"
          />
        </div>
      ))}
    </div>
  );
}
