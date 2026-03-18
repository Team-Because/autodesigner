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
    hint: "Who you are, what you do, and what makes you unique. This sets the AI's understanding of your brand.",
    placeholder:
      "Premium frozen snacks brand.\nProducts: Samosas, Spring Rolls, Momos.\nKnown for: authentic taste, ready in 3 minutes, no preservatives.",
    rows: 4,
  },
  {
    key: "mustInclude",
    label: "Must-Include Elements",
    hint: "Text that MUST appear on every creative. The AI will include these verbatim.",
    placeholder:
      'Brand Name: Meevaa Foods\nTagline: "Taste of Home"\nCTA: Order Now | Link in bio\nContact: www.meevaafoods.com',
    rows: 4,
  },
  {
    key: "visualDirection",
    label: "Visual Direction",
    hint: "Describe the look and feel you want. Be specific — this directly guides the AI's visual choices.",
    placeholder:
      "Mood: Warm, appetizing, casual premium\nFood is always the hero — drool-worthy close-ups, steam/texture visible\nLighting: Bright, warm, natural\nLayout: Clean, not cluttered. Food dominates 50-70% of the frame.",
    rows: 5,
  },
  {
    key: "voiceAndTone",
    label: "Voice & Tone",
    hint: "How the brand speaks. The AI uses this to write headlines, taglines, and copy.",
    placeholder:
      "Voice: Friendly, relatable, slightly playful\nAudience: Young professionals, 25-40, urban foodies\nUse short punchy lines, not corporate speak\nAvoid: Overly formal language, health claims",
    rows: 4,
  },
  {
    key: "dos",
    label: "Do's — Always",
    hint: "Positive rules the AI should always follow. Think of these as creative reinforcements.",
    placeholder:
      "- Always show the food looking appetizing and freshly prepared\n- Use brand colors prominently\n- Keep the logo clearly visible\n- Include the product name in the headline",
    rows: 4,
  },
  {
    key: "donts",
    label: "Don'ts — Never",
    hint: "Hard exclusions. The AI treats these as strict negative constraints.",
    placeholder:
      "- No generic stock photos\n- No cluttered layouts with too many elements\n- Never use fear-based or aggressive urgency\n- No text that's hard to read against the background",
    rows: 4,
  },
  {
    key: "colorNotes",
    label: "Color Usage Notes",
    hint: "Rules beyond hex codes — when and how to use your colors.",
    placeholder:
      "Red (#D32F2F) for accents and CTAs only, never as full background.\nCream (#FFF5E1) as secondary — use for text panels or backgrounds.\nWhite text on dark overlays for readability.",
    rows: 3,
  },
  {
    key: "referenceNotes",
    label: "Additional Notes",
    hint: "Anything else — seasonal rules, asset handling, special instructions.",
    placeholder:
      "Logo must never be stretched or recolored.\nDuring festivals, subtle traditional motifs are OK.\nProduct packaging shots should match actual pack design.",
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
