import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Save, Loader2, X, ImagePlus, Plus, ChevronDown, Lightbulb, Check, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BrandAutofillPanel, { type AutofillResult } from "@/components/BrandAutofillPanel";
import PasteParseWizard from "@/components/PasteParseWizard";
import { readNevers, writeNevers, type ParsedMasterOutput } from "@/lib/brandParser";

const BASE_CATEGORIES = [
  "Logo",
  "Hero Image",
  "Product",
  "Lifestyle",
  "Icon",
  "Pattern/Texture",
  "Banner",
  "Infographic",
  "Style Reference",
  "Other",
];

const INDUSTRY_CATEGORIES: Record<string, string[]> = {
  "Real Estate": [
    "Logo", "Elevation", "Interior", "Exterior",
    "Amenity", "Lifestyle", "RERA QR",
    "Pattern/Texture", "Render",
  ],
  "Education": [
    "Logo", "Campus", "Classroom", "Student Life",
    "Faculty", "Lab", "Library", "Playground",
    "Graduation", "Sports",
  ],
  "Healthcare": [
    "Logo", "Facility", "Medical Equipment", "Patient Care",
    "Doctor/Staff", "Wellness", "Lab", "Pharmacy",
    "Hospital Exterior", "Therapy",
  ],
  "Retail": [
    "Logo", "Store/Venue", "Product", "Packaging",
    "Catalogue", "Display/Shelf", "E-commerce Shot",
    "Window Display", "Lifestyle", "Banner",
  ],
  "Fashion": [
    "Logo", "Lookbook", "On-Model", "Flat Lay",
    "Swatch", "Fabric Close-up", "Collection",
    "Runway", "Accessories", "Lifestyle",
  ],
  "Technology": [
    "Logo", "Screenshot", "UI Mockup", "Device Render",
    "Dashboard", "Feature Highlight", "Mobile View",
    "Desktop View", "Icon", "Banner",
  ],
  "Food & Beverage": [
    "Logo", "Dish/Menu Item", "Packaging", "Restaurant/Venue",
    "Ingredient", "Plating", "Drink", "Kitchen",
    "Chef/Staff", "Menu Card",
  ],
  "Automotive": [
    "Logo", "Exterior Shot", "Interior Shot", "Detail/Close-up",
    "On Road", "Showroom", "Dashboard View",
    "Colour Options", "Lifestyle", "Banner",
  ],
  "Hospitality": [
    "Logo", "Room/Suite", "Amenity", "Dining",
    "Spa/Wellness", "Pool", "Lobby", "Aerial View",
    "Guest Experience", "Lifestyle",
  ],
  "Finance": [
    "Logo", "Data Visualization", "Office/Branch",
    "Card/Product", "Mobile Banking", "Investment Chart",
    "Team Photo", "Lifestyle", "Banner", "Report",
  ],
};

const INDUSTRIES = Object.keys(INDUSTRY_CATEGORIES);

const getAssetCategories = (industry: string | null) => {
  if (!industry || !INDUSTRY_CATEGORIES[industry]) return BASE_CATEGORIES;
  return [...INDUSTRY_CATEGORIES[industry], "Other"];
};

interface AssetItem {
  id?: string;
  image_url: string;
  label: string;
  isNew?: boolean;
}

interface ExtraColor {
  name: string;
  hex: string;
}

export default function BrandForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = id && id !== "new";

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [secondaryColor, setSecondaryColor] = useState("#DBEAFE");
  const [extraColors, setExtraColors] = useState<ExtraColor[]>([]);
  const [voiceRules, setVoiceRules] = useState("");
  const [visualNevers, setVisualNevers] = useState("");
  const [contentNevers, setContentNevers] = useState("");
  const [legacyNevers, setLegacyNevers] = useState(""); // back-compat for unsplit text
  // Structured brief sections
  const [briefIdentity, setBriefIdentity] = useState("");
  const [briefMandatory, setBriefMandatory] = useState("");
  const [briefVisual, setBriefVisual] = useState("");
  const [briefCopy, setBriefCopy] = useState("");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [industry, setIndustry] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Parse existing brand_brief into structured sections.
  // Recognizes Master Prompt headers + common synonyms used across our brand
  // playbooks (VISUAL DNA, MANDATORY ELEMENTS, COLOUR PALETTE, etc.).
  // Unknown sections are NEVER dropped — they're appended (with their header
  // intact) to the closest semantic bucket so the AI still sees them.
  const parseBrief = (raw: string) => {
    type Key = "identity" | "mandatory" | "visual" | "copy";
    const sections: Record<Key, string> = { identity: "", mandatory: "", visual: "", copy: "" };

    // Synonym map → canonical bucket. Keys are lowercased & trimmed.
    const sectionMap: Record<string, Key> = {
      // Identity
      "brand identity": "identity",
      "identity": "identity",
      "brand": "identity",
      "about": "identity",
      "about the brand": "identity",
      "overview": "identity",
      // Mandatory
      "must-include elements": "mandatory",
      "must include elements": "mandatory",
      "mandatory elements": "mandatory",
      "mandatory": "mandatory",
      "compliance": "mandatory",
      "legal": "mandatory",
      // Visual direction (most critical)
      "visual direction": "visual",
      "visual dna": "visual",
      "visual style": "visual",
      "visual language": "visual",
      "design direction": "visual",
      "art direction": "visual",
      "look and feel": "visual",
      "look & feel": "visual",
      "mood": "visual",
      "mood & tone": "visual",
      // Example copy
      "example copy": "copy",
      "copy examples": "copy",
      "sample copy": "copy",
      "copy": "copy",
      "messaging examples": "copy",
      "headlines": "copy",
    };

    // Headers we want to keep as part of the brief but route to a sensible
    // bucket (preserving the heading so the AI can still read the label).
    const fallbackBucket: Record<string, Key> = {
      "colour palette": "visual",
      "color palette": "visual",
      "palette": "visual",
      "typography": "visual",
      "textures & elements": "visual",
      "textures and elements": "visual",
      "messaging pillars": "copy",
      "vocabulary": "copy",
      "tone": "copy",
      "tone & voice": "copy",
      "tone and voice": "copy",
      "voice": "copy",
      "target audience": "copy",
      "audience": "copy",
      "visual nevers": "visual",
      "content nevers": "copy",
      "the never list": "mandatory",
      "never list": "mandatory",
    };

    // Strip a single ``` fenced block wrapper if the LLM wrapped the section.
    const stripFence = (s: string) =>
      s.replace(/^```[a-zA-Z]*\n?/gm, "").replace(/```$/gm, "");

    const cleaned = stripFence(raw);
    const lines = cleaned.split("\n");

    let currentKey: Key | null = null;
    let currentIsFallback = false;
    const preamble: string[] = [];

    for (const line of lines) {
      // Match ##, ### or #### headers. Strip leading "BRAND BRIEF —" or
      // numbering like "1." or "Step 1:" the LLM sometimes adds.
      const headerMatch = line.match(/^#{2,4}\s+(.+?)\s*$/);
      if (headerMatch) {
        let title = headerMatch[1].trim();
        // Drop common prefixes
        title = title
          .replace(/^brand brief\s*[—\-:]\s*/i, "")
          .replace(/^section\s*\d+\s*[:.\-]\s*/i, "")
          .replace(/^\d+\.\s*/, "")
          .replace(/[:．。]+$/, "")
          .trim();
        const key = title.toLowerCase();

        if (sectionMap[key]) {
          currentKey = sectionMap[key];
          currentIsFallback = false;
          continue;
        }
        if (fallbackBucket[key]) {
          currentKey = fallbackBucket[key];
          currentIsFallback = true;
          // Preserve the original heading so the AI sees the label
          sections[currentKey] += (sections[currentKey] ? "\n\n" : "") + `## ${title}`;
          continue;
        }
        // Unknown header → keep heading + content in the last-used bucket,
        // or stash in preamble if none yet.
        if (currentKey) {
          sections[currentKey] += (sections[currentKey] ? "\n\n" : "") + `## ${title}`;
          currentIsFallback = true;
        } else {
          preamble.push(`## ${title}`);
        }
        continue;
      }

      if (currentKey) {
        sections[currentKey] += (sections[currentKey] ? "\n" : "") + line;
      } else {
        preamble.push(line);
      }
    }

    // Filter obvious LLM filler from the preamble before prepending to identity.
    const filteredPreamble = preamble
      .join("\n")
      .replace(/^(here'?s?|sure|of course|certainly|below is|absolutely)[^\n]*\n?/i, "")
      .trim();
    if (filteredPreamble) {
      sections.identity = filteredPreamble + (sections.identity ? "\n\n" + sections.identity : "");
    }

    // Trim & collapse excessive blank lines per section.
    const tidy = (s: string) => s.replace(/\n{3,}/g, "\n\n").trim();

    void currentIsFallback; // currently used only for clarity above

    return {
      identity: tidy(sections.identity),
      mandatory: tidy(sections.mandatory),
      visual: tidy(sections.visual),
      copy: tidy(sections.copy),
    };
  };

  // Combine structured sections into a single brand_brief string.
  // Headers are UPPERCASE to match the Master Prompt output exactly, so a
  // round-trip (parse → edit → save → parse) is lossless.
  const combineBrief = () => {
    const parts: string[] = [];
    if (briefIdentity.trim()) parts.push(`## BRAND IDENTITY\n${briefIdentity.trim()}`);
    if (briefMandatory.trim()) parts.push(`## MUST-INCLUDE ELEMENTS\n${briefMandatory.trim()}`);
    if (briefVisual.trim()) parts.push(`## VISUAL DIRECTION\n${briefVisual.trim()}`);
    if (briefCopy.trim()) parts.push(`## EXAMPLE COPY\n${briefCopy.trim()}`);
    return parts.join("\n\n");
  };

  useEffect(() => {
    if (isEditing) {
      Promise.all([
        supabase.from("brands").select("*").eq("id", id).single(),
        supabase.from("brand_assets").select("*").eq("brand_id", id).order("created_at", { ascending: true }),
      ]).then(([brandRes, assetsRes]) => {
        if (brandRes.data) {
          const data = brandRes.data;
          setName(data.name);
          setPrimaryColor(data.primary_color);
          setSecondaryColor(data.secondary_color);
          setVoiceRules(data.brand_voice_rules || "");
          const split = readNevers(data.negative_prompts || "");
          setVisualNevers(split.visual);
          setContentNevers(split.content);
          setLegacyNevers(split.general);
          const briefRaw = (data as any).brand_brief || "";
          const parsed = parseBrief(briefRaw);
          setBriefIdentity(parsed.identity);
          setBriefMandatory(parsed.mandatory);
          setBriefVisual(parsed.visual);
          setBriefCopy(parsed.copy);
          // Load extra colors
          const ec = (data as any).extra_colors;
          if (ec && Array.isArray(ec)) {
            setExtraColors(ec);
          }
          // Load industry
          setIndustry((data as any).industry || null);
        }
        if (assetsRes.data) {
          setAssets(assetsRes.data.map((a: any) => ({ id: a.id, image_url: a.image_url, label: a.label || "" })));
        }
      });
    }
  }, [id, isEditing]);

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from("brand-assets").upload(path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage.from("brand-assets").getPublicUrl(path);

      if (isEditing) {
        const { data: inserted, error: insertErr } = await supabase
          .from("brand_assets")
          .insert({ brand_id: id, user_id: user.id, image_url: urlData.publicUrl, label: "" })
          .select()
          .single();
        if (!insertErr && inserted) {
          setAssets((prev) => [...prev, { id: inserted.id, image_url: urlData.publicUrl, label: "" }]);
        }
      } else {
        setAssets((prev) => [...prev, { image_url: urlData.publicUrl, label: "", isNew: true }]);
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleRemoveAsset = async (index: number) => {
    const asset = assets[index];
    if (asset.id) {
      await supabase.from("brand_assets").delete().eq("id", asset.id);
    }
    setAssets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, label: string) => {
    setAssets((prev) => prev.map((a, i) => (i === index ? { ...a, label } : a)));
  };

  // Auto-save label on blur for existing assets
  const handleLabelBlur = useCallback(async (index: number) => {
    const asset = assets[index];
    if (asset.id && isEditing) {
      const { error } = await supabase
        .from("brand_assets")
        .update({ label: asset.label })
        .eq("id", asset.id);
      if (error) {
        toast.error("Failed to save tag.");
      } else {
        toast.success("Tag saved.");
      }
    }
  }, [assets, isEditing]);

  // Extra colors management
  const addExtraColor = () => {
    setExtraColors((prev) => [...prev, { name: "", hex: "#888888" }]);
  };

  const updateExtraColor = (index: number, field: keyof ExtraColor, value: string) => {
    setExtraColors((prev) => prev.map((c, i) => (i === index ? { ...c, [field]: value } : c)));
  };

  const removeExtraColor = (index: number) => {
    setExtraColors((prev) => prev.filter((_, i) => i !== index));
  };

  // Non-destructively apply AI autofill results.
  // - Text fields are filled ONLY if currently empty (never overwrite user input).
  // - Colors fill only if still at the defaults.
  // - Industry fills only if not already set.
  // - Uploaded assets are appended (and persisted immediately when editing).
  const applyAutofill = async (result: AutofillResult) => {
    const DEFAULT_PRIMARY = "#2563EB";
    const DEFAULT_SECONDARY = "#DBEAFE";

    if (!industry && result.industry) setIndustry(result.industry);
    if ((!primaryColor || primaryColor === DEFAULT_PRIMARY) && /^#[0-9a-f]{6}$/i.test(result.primary_color)) {
      setPrimaryColor(result.primary_color);
    }
    if ((!secondaryColor || secondaryColor === DEFAULT_SECONDARY) && /^#[0-9a-f]{6}$/i.test(result.secondary_color)) {
      setSecondaryColor(result.secondary_color);
    }
    if (extraColors.length === 0 && Array.isArray(result.extra_colors) && result.extra_colors.length > 0) {
      const valid = result.extra_colors.filter(
        (c) => c && typeof c.name === "string" && /^#[0-9a-f]{6}$/i.test(c.hex)
      );
      if (valid.length > 0) setExtraColors(valid);
    }
    if (!briefIdentity.trim() && result.brief_identity) setBriefIdentity(result.brief_identity);
    if (!briefMandatory.trim() && result.brief_mandatory) setBriefMandatory(result.brief_mandatory);
    if (!briefVisual.trim() && result.brief_visual) setBriefVisual(result.brief_visual);
    if (!briefCopy.trim() && result.brief_copy) setBriefCopy(result.brief_copy);
    if (!voiceRules.trim() && result.brand_voice_rules) setVoiceRules(result.brand_voice_rules);
    if (result.negative_prompts) {
      // Autofill returns a single negative_prompts blob — split it on the way in.
      const incoming = readNevers(result.negative_prompts);
      if (!visualNevers.trim() && incoming.visual) setVisualNevers(incoming.visual);
      if (!contentNevers.trim() && incoming.content) setContentNevers(incoming.content);
      if (!legacyNevers.trim() && !visualNevers.trim() && !contentNevers.trim() && incoming.general) {
        // Old-style blob — drop into content nevers (safer default for mood derivation).
        setContentNevers(incoming.general);
      }
    }

    // Append uploaded assets with predicted tags.
    if (result.uploaded_assets?.length) {
      if (isEditing && id && user) {
        // Persist immediately so re-tagging works without saving the whole form.
        const rows = result.uploaded_assets.map((a) => ({
          brand_id: id,
          user_id: user.id,
          image_url: a.image_url,
          label: a.predicted_tag || "",
        }));
        const { data: inserted, error } = await supabase
          .from("brand_assets")
          .insert(rows)
          .select();
        if (error) {
          toast.error("Failed to attach uploaded assets.");
        } else if (inserted) {
          setAssets((prev) => [
            ...prev,
            ...inserted.map((a: { id: string; image_url: string; label: string | null }) => ({
              id: a.id,
              image_url: a.image_url,
              label: a.label || "",
            })),
          ]);
        }
      } else {
        setAssets((prev) => [
          ...prev,
          ...result.uploaded_assets.map((a) => ({
            image_url: a.image_url,
            label: a.predicted_tag || "",
            isNew: true,
          })),
        ]);
      }
    }
  };

  // Apply parsed Master Prompt output. Like applyAutofill, never overwrites
  // existing values. Asset tags are matched by 1-based index against the
  // current gallery (logo first if present).
  const applyPasteParse = (p: ParsedMasterOutput) => {
    if (!name.trim() && p.brandName) setName(p.brandName);
    if (!industry && p.industry) setIndustry(p.industry);
    if ((primaryColor === "#2563EB") && p.primaryColor) setPrimaryColor(p.primaryColor);
    if ((secondaryColor === "#DBEAFE") && p.secondaryColor) setSecondaryColor(p.secondaryColor);
    if (extraColors.length === 0 && p.extraColors.length > 0) setExtraColors(p.extraColors);
    if (!briefIdentity.trim() && p.briefIdentity) setBriefIdentity(p.briefIdentity);
    if (!briefMandatory.trim() && p.briefMandatory) setBriefMandatory(p.briefMandatory);
    if (!briefVisual.trim() && p.briefVisual) setBriefVisual(p.briefVisual);
    if (!briefCopy.trim() && p.briefCopy) setBriefCopy(p.briefCopy);
    if (!voiceRules.trim() && p.voiceRules) setVoiceRules(p.voiceRules);
    if (!visualNevers.trim() && p.visualNevers) setVisualNevers(p.visualNevers);
    if (!contentNevers.trim() && p.contentNevers) setContentNevers(p.contentNevers);

    if (p.assetTags.length && assets.length) {
      setAssets((prev) => prev.map((a, i) => {
        if (a.label) return a; // don't overwrite existing tag
        const match = p.assetTags.find((t) => t.index === i + 1);
        return match ? { ...a, label: match.tag } : a;
      }));
    }

    toast.success(`Applied parsed brand profile.`);
  };
    e.preventDefault();
    if (!name.trim() || !user) {
      toast.error("Brand name is required.");
      return;
    }

    setLoading(true);
    const payload: any = {
      name,
      logo_url: assets.find((a) => a.label === "Logo")?.image_url || (assets.length > 0 ? assets[0].image_url : ""),
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      extra_colors: extraColors,
      brand_voice_rules: voiceRules,
      negative_prompts: writeNevers(visualNevers, contentNevers, legacyNevers),
      brand_brief: combineBrief(),
      industry: industry,
      user_id: user.id,
    };

    let brandId = id;
    let error;

    if (isEditing) {
      ({ error } = await supabase.from("brands").update(payload).eq("id", id));
      // Update labels for existing assets
      for (const asset of assets) {
        if (asset.id) {
          await supabase.from("brand_assets").update({ label: asset.label }).eq("id", asset.id);
        }
      }
    } else {
      const { data, error: insertErr } = await supabase.from("brands").insert(payload).select().single();
      error = insertErr;
      brandId = data?.id;

      if (!error && brandId) {
        const newAssets = assets.map((a) => ({
          brand_id: brandId!,
          user_id: user.id,
          image_url: a.image_url,
          label: a.label,
        }));
        if (newAssets.length > 0) {
          await supabase.from("brand_assets").insert(newAssets);
        }
      }
    }

    setLoading(false);
    if (error) {
      toast.error("Failed to save brand.");
    } else {
      toast.success(`"${name}" ${isEditing ? "updated" : "created"} successfully.`);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      navigate("/brands");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <Button variant="ghost" onClick={() => navigate("/brands")} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Back to Brand Hub
      </Button>

      <BrandAutofillPanel brandNameHint={name} onApply={applyAutofill} />

      <h1 className="text-2xl font-display font-bold">
        {isEditing ? "Edit Brand" : "Create New Brand"}
      </h1>

      {/* Best Practices Guide */}
      <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
        <Card className="border-secondary bg-accent/30">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors rounded-t-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Lightbulb className="h-5 w-5 text-secondary" />
                  <CardTitle className="text-base font-display">Brand Setup Best Practices</CardTitle>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${guideOpen ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Tips for the best AI-generated creatives</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 text-sm text-foreground">
              <div className="space-y-3">
                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Upload & tag all visual assets</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Upload logos, building renders, product shots, mascots, and patterns. Tag each one (e.g., "Logo", "Architecture") so the AI knows how to use them correctly — logos stay exact, hero images set the mood.</p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Define your full color palette</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Set Primary & Secondary colors, then add extra colors (Accent, Background, Text, etc.) with descriptive names. Include usage rules like "Red only for developer branding, never as the main visual color."</p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Write a structured Brand Brief</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Use clear sections with markdown headers:<br />
                      <code className="bg-muted px-1 rounded text-xs">## VISUAL DNA</code> — mood, lighting, photography style<br />
                      <code className="bg-muted px-1 rounded text-xs">## MANDATORY ELEMENTS</code> — project name, tagline, contact, legal text<br />
                      <code className="bg-muted px-1 rounded text-xs">## COLOUR PALETTE</code> — full palette with usage guidance<br />
                      <code className="bg-muted px-1 rounded text-xs">## MESSAGING PILLARS</code> — key themes and vocabulary<br />
                      <code className="bg-muted px-1 rounded text-xs">## VOCABULARY</code> — words to use vs. words to avoid
                    </p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Separate "Visual Nevers" from "Content Nevers"</p>
                    <p className="text-muted-foreground text-xs mt-0.5">In the Never List, use two sections: <code className="bg-muted px-1 rounded text-xs">## VISUAL NEVERS</code> (e.g., "Never alter villa rooflines") and <code className="bg-muted px-1 rounded text-xs">## CONTENT NEVERS</code> (e.g., "Never use the word 'cheap'"). This prevents the AI from mixing up visual and text constraints.</p>
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Be specific about your audience</p>
                    <p className="text-muted-foreground text-xs mt-0.5">In "Tone & Audience", include age range, psychographics, and the desired emotional response. E.g., "Affluent homebuyers (35-55) seeking low-density luxury living — tone should feel grounded, premium, and nature-led."</p>
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-border/50">
                <Link to="/brand-guide" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                  <ExternalLink className="h-3 w-3" /> View the full Brand Setup Guide with templates
                </Link>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Brand Name</Label>
              <Input id="name" value={name} onChange={(e) => { if (e.target.value.length <= 100) setName(e.target.value); }} placeholder="e.g., Shanti Juniors" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select value={industry || ""} onValueChange={(val) => setIndustry(val || null)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select industry for smart asset tags…" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Adds industry-specific asset tags (e.g., Floor Plan for Real Estate, Lookbook for Fashion)</p>
            </div>
          </CardContent>
        </Card>

        {/* Multi-Image Asset Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Assets</CardTitle>
            <CardDescription>Upload logos, product photos, building shots, mascots — tag each so the AI knows its role. The first image becomes the brand thumbnail.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {assets.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assets.map((asset, index) => (
                  <div key={asset.id || index} className="relative group rounded-lg border border-border overflow-hidden bg-muted">
                    <div className="aspect-square">
                      <img src={asset.image_url} alt={asset.label || `Asset ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2 space-y-1">
                      <Select
                        value={asset.label?.startsWith("Other:") ? "Other" : (asset.label || "")}
                        onValueChange={(val) => {
                          const newLabel = val === "Other" ? "Other:" : val;
                          handleLabelChange(index, newLabel);
                          if (val !== "Other" && asset.id && isEditing) {
                            supabase
                              .from("brand_assets")
                              .update({ label: newLabel })
                              .eq("id", asset.id)
                              .then(({ error }) => {
                                if (error) toast.error("Failed to save tag.");
                              });
                          }
                        }}
                      >
                        <SelectTrigger className="text-xs h-7">
                          <SelectValue placeholder="Select category…" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAssetCategories(industry).map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(asset.label === "Other:" || asset.label?.startsWith("Other:")) && (
                        <Input
                          className="text-xs h-7"
                          placeholder="Describe this asset…"
                          value={asset.label.replace(/^Other:\s*/, "")}
                          maxLength={50}
                          onChange={(e) => {
                            if (e.target.value.length <= 50) {
                              const customLabel = e.target.value ? `Other: ${e.target.value}` : "Other:";
                              handleLabelChange(index, customLabel);
                            }
                          }}
                          onBlur={() => {
                            if (asset.id && isEditing) {
                              supabase
                                .from("brand_assets")
                                .update({ label: asset.label })
                                .eq("id", asset.id)
                                .then(({ error }) => {
                                  if (error) toast.error("Failed to save tag.");
                                });
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                        />
                      )}
                    </div>
                    {index === 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Thumbnail
                      </span>
                    )}
                    {asset.label && asset.label !== "Other:" && (
                      <Badge variant="secondary" className="absolute top-1.5 right-8 text-[10px] bg-background/80 backdrop-blur-sm group-hover:hidden">
                        {asset.label.startsWith("Other: ") ? asset.label.replace("Other: ", "") : asset.label}
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAsset(index)}
                      className="absolute top-1.5 right-1.5 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <label className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors block">
              {uploading ? (
                <Loader2 className="h-6 w-6 mx-auto text-muted-foreground mb-2 animate-spin" />
              ) : (
                <ImagePlus className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
              )}
              <p className="text-sm text-muted-foreground">
                {uploading ? "Uploading..." : "Click to add images"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB — select multiple</p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleAssetUpload}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </CardContent>
        </Card>

        {/* Color Palette */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Color Palette</CardTitle>
            <CardDescription>Define your complete palette. Name each color for context (e.g., "Accent Gold", "Text Dark Brown").</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary">Primary Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 w-12 rounded-md border border-input cursor-pointer" />
                  <Input id="primary" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary">Secondary Color</Label>
                <div className="flex gap-2">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-10 w-12 rounded-md border border-input cursor-pointer" />
                  <Input id="secondary" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>
            </div>

            {/* Extra colors */}
            {extraColors.length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="text-xs text-muted-foreground">Additional Colors</Label>
                {extraColors.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color.hex}
                      onChange={(e) => updateExtraColor(index, "hex", e.target.value)}
                      className="h-9 w-10 rounded-md border border-input cursor-pointer shrink-0"
                    />
                    <Input
                      value={color.hex}
                      onChange={(e) => updateExtraColor(index, "hex", e.target.value)}
                      className="font-mono text-sm w-28 shrink-0"
                    />
                    <Input
                      value={color.name}
                      onChange={(e) => { if (e.target.value.length <= 30) updateExtraColor(index, "name", e.target.value); }}
                      placeholder="e.g., Accent Gold"
                      className="text-sm flex-1"
                      maxLength={30}
                    />
                    <button
                      type="button"
                      onClick={() => removeExtraColor(index)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <Button type="button" variant="outline" size="sm" onClick={addExtraColor} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Color
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Brief</CardTitle>
            <CardDescription>Structured sections help the AI use your brand data accurately. Fill in what applies.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="brief-identity">Brand Identity</Label>
              <Textarea
                id="brief-identity"
                value={briefIdentity}
                onChange={(e) => { if (e.target.value.length <= 1000) setBriefIdentity(e.target.value); }}
                placeholder="Project name, location, developer, USP, key differentiators..."
                rows={4}
                className="text-sm"
                maxLength={1000}
              />
              <p className={`text-xs ${briefIdentity.length > 900 ? "text-amber-500" : "text-muted-foreground"}`}>{briefIdentity.length}/1000 — Project name, location, developer, USP</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-mandatory">Must-Include Elements</Label>
              <Textarea
                id="brief-mandatory"
                value={briefMandatory}
                onChange={(e) => { if (e.target.value.length <= 600) setBriefMandatory(e.target.value); }}
                placeholder="RERA number, contact info, tagline, legal text, website URL..."
                rows={3}
                className="text-sm"
                maxLength={600}
              />
              <p className={`text-xs ${briefMandatory.length > 540 ? "text-amber-500" : "text-muted-foreground"}`}>{briefMandatory.length}/600 — RERA, contact, tagline, legal text</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-visual">Visual Direction</Label>
              <Textarea
                id="brief-visual"
                value={briefVisual}
                onChange={(e) => { if (e.target.value.length <= 800) setBriefVisual(e.target.value); }}
                placeholder="Mood: premium & nature-led. Lighting: golden hour. Style: editorial photography. Layout: clean with breathing room..."
                rows={3}
                className="text-sm"
                maxLength={800}
              />
              <p className={`text-xs ${briefVisual.length > 720 ? "text-amber-500" : "text-muted-foreground"}`}>{briefVisual.length}/800 — Mood, lighting, photography style, layout preferences</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-copy">Example Copy</Label>
              <Textarea
                id="brief-copy"
                value={briefCopy}
                onChange={(e) => { if (e.target.value.length <= 600) setBriefCopy(e.target.value); }}
                placeholder='Headlines: "Live Above The Ordinary" | CTAs: "Enquire Now", "Book a Site Visit" | Taglines: "Where Nature Meets Luxury"'
                rows={3}
                className="text-sm"
                maxLength={600}
              />
              <p className={`text-xs ${briefCopy.length > 540 ? "text-amber-500" : "text-muted-foreground"}`}>{briefCopy.length}/600 — Sample headlines, CTAs, taglines the AI can use or adapt</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Communication Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice">Tone, Demographics & Target Audience</Label>
              <Textarea
                id="voice"
                value={voiceRules}
                onChange={(e) => { if (e.target.value.length <= 1800) setVoiceRules(e.target.value); }}
                placeholder='"Subjects must strictly be 3-4 year old toddlers. Warm, nurturing tone."'
                rows={4}
                maxLength={1800}
              />
              <p className={`text-xs ${voiceRules.length > 1600 ? "text-amber-500" : "text-muted-foreground"}`}>{voiceRules.length}/1800</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visual-nevers">Visual Nevers <span className="text-muted-foreground font-normal">(image / design constraints)</span></Label>
              <Textarea
                id="visual-nevers"
                value={visualNevers}
                onChange={(e) => { if (e.target.value.length <= 600) setVisualNevers(e.target.value); }}
                placeholder='"Never distort the logo. Never use stock photography. Never place text over key product imagery."'
                rows={3}
                maxLength={600}
              />
              <p className={`text-xs ${visualNevers.length > 540 ? "text-amber-500" : "text-muted-foreground"}`}>{visualNevers.length}/600 — Drives image-prompt exclusions only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-nevers">Content Nevers <span className="text-muted-foreground font-normal">(copywriting / messaging constraints)</span></Label>
              <Textarea
                id="content-nevers"
                value={contentNevers}
                onChange={(e) => { if (e.target.value.length <= 600) setContentNevers(e.target.value); }}
                placeholder='"Never use the word cheap. Never use fear-based urgency. Never omit the RERA number."'
                rows={3}
                maxLength={600}
              />
              <p className={`text-xs ${contentNevers.length > 540 ? "text-amber-500" : "text-muted-foreground"}`}>{contentNevers.length}/600 — Drives copy & mood derivation</p>
            </div>
            {legacyNevers && (
              <div className="space-y-2">
                <Label htmlFor="legacy-nevers" className="text-muted-foreground">Legacy Nevers <span className="text-[10px] font-normal">(unsplit — consider moving into Visual or Content above)</span></Label>
                <Textarea
                  id="legacy-nevers"
                  value={legacyNevers}
                  onChange={(e) => { if (e.target.value.length <= 1200) setLegacyNevers(e.target.value); }}
                  rows={3}
                  maxLength={1200}
                  className="text-xs"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={loading} className="gradient-primary hover:gradient-primary-hover text-primary-foreground px-8 rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Save Changes" : "Create Brand"}
          </Button>
        </div>
      </form>
    </div>
  );
}
