import { useEffect, useState, useCallback, useMemo } from "react";
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
import { ArrowLeft, Save, Loader2, X, ImagePlus, Plus, ChevronDown, Lightbulb, Check, ExternalLink, Sparkles, Tags } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import BrandAutofillPanel, { type AutofillResult } from "@/components/BrandAutofillPanel";
import PasteParseWizard from "@/components/PasteParseWizard";
import { readNevers, writeNevers, type ParsedMasterOutput } from "@/lib/brandParser";
import { scoreBrandHealth, deriveBrandMoods } from "@/lib/brandHealth";

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
  const [brandOwnerId, setBrandOwnerId] = useState<string | null>(null);
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
  const [detectingIndustry, setDetectingIndustry] = useState(false);
  const [retaggingAssets, setRetaggingAssets] = useState(false);

  // Live brand-health score — same signals used by Studio pre-flight + BrandHub.
  const healthScore = useMemo(
    () => scoreBrandHealth({
      hasLogo: assets.some((a) => a.label === "Logo") || !!(assets[0]?.image_url),
      taggedAssetCount: assets.filter((a) => a.label && a.label !== "Other:").length,
      briefIdentity,
      briefVisual,
      voiceRules,
      visualNevers,
      contentNevers,
      industry,
    }),
    [assets, briefIdentity, briefVisual, voiceRules, visualNevers, contentNevers, industry],
  );

  // Live mood pool — mirrors generator's deriveBrandMoods() exactly so users
  // see which copy moods their brief unlocks downstream.
  const moodPool = useMemo(() => {
    const combinedBrief = [briefIdentity, briefMandatory, briefVisual, briefCopy].filter(Boolean).join("\n\n");
    const combinedNevers = [visualNevers, contentNevers, legacyNevers].filter(Boolean).join("\n\n");
    return deriveBrandMoods(combinedBrief, voiceRules, combinedNevers);
  }, [briefIdentity, briefMandatory, briefVisual, briefCopy, voiceRules, visualNevers, contentNevers, legacyNevers]);

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

  // Auto-detect industry from existing brief + asset labels via LLM.
  // Calls brand-autofill in "industry-only" mode and applies the result.
  const handleDetectIndustry = async () => {
    if (industry) {
      toast.info("Industry already set — clear it first to re-detect.");
      return;
    }
    const briefBlob = [briefIdentity, briefMandatory, briefVisual, briefCopy, voiceRules].filter(Boolean).join("\n\n");
    const assetLabels = assets.map((a) => a.label).filter(Boolean).join(", ");
    if (!briefBlob.trim() && !assetLabels) {
      toast.error("Add a brief or tagged assets first so we have something to classify.");
      return;
    }
    setDetectingIndustry(true);
    try {
      const { data, error } = await supabase.functions.invoke("brand-autofill", {
        body: {
          mode: "industry-only",
          brand_name_hint: name,
          existing_brief: briefBlob,
          existing_asset_labels: assetLabels,
        },
      });
      if (error) throw error;
      const detected = (data as { industry?: string })?.industry;
      if (detected && typeof detected === "string") {
        setIndustry(detected);
        toast.success(`Industry detected: ${detected}`);
      } else {
        toast.error("Couldn't confidently detect an industry — please pick one manually.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Detection failed: ${msg}`);
    } finally {
      setDetectingIndustry(false);
    }
  };

  // Re-classify all asset labels via LLM using current industry vocabulary.
  // Useful when industry was set AFTER assets were uploaded.
  const handleRetagAssets = async () => {
    if (!industry) {
      toast.error("Set an industry first so the AI knows the tag vocabulary.");
      return;
    }
    if (assets.length === 0) {
      toast.error("No assets to re-tag.");
      return;
    }
    setRetaggingAssets(true);
    try {
      const { data, error } = await supabase.functions.invoke("brand-autofill", {
        body: {
          mode: "retag-assets",
          brand_name_hint: name,
          industry,
          asset_urls: assets.map((a, i) => ({ index: i, url: a.image_url, current_label: a.label || "" })),
        },
      });
      if (error) throw error;
      const tags = (data as { tags?: { index: number; label: string }[] })?.tags || [];
      if (tags.length === 0) {
        toast.error("No tags returned — try again.");
        return;
      }
      const next = [...assets];
      let updated = 0;
      for (const t of tags) {
        if (typeof t.index !== "number" || !t.label || !next[t.index]) continue;
        next[t.index] = { ...next[t.index], label: t.label };
        if (next[t.index].id && isEditing) {
          await supabase.from("brand_assets").update({ label: t.label }).eq("id", next[t.index].id!);
        }
        updated++;
      }
      setAssets(next);
      toast.success(`Re-tagged ${updated} asset${updated === 1 ? "" : "s"}.`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Re-tag failed: ${msg}`);
    } finally {
      setRetaggingAssets(false);
    }
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
          setBrandOwnerId(data.user_id);
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
        const assetOwnerId = brandOwnerId || user.id;
        const { data: inserted, error: insertErr } = await supabase
          .from("brand_assets")
          .insert({ brand_id: id, user_id: assetOwnerId, image_url: urlData.publicUrl, label: "" })
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
        const assetOwnerId = brandOwnerId || user.id;
        const rows = result.uploaded_assets.map((a) => ({
          brand_id: id,
          user_id: assetOwnerId,
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) {
      toast.error("Brand name is required.");
      return;
    }

    setLoading(true);
    // Preserve original owner when editing — admins must not steal brands.
    const ownerId = isEditing ? (brandOwnerId || user.id) : user.id;
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
      user_id: ownerId,
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

      <BrandAutofillPanel brandNameHint={name} onApply={applyAutofill} defaultOpen={!isEditing} />
      <PasteParseWizard onApply={applyPasteParse} />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-display font-bold">
          {isEditing ? "Edit Brand" : "Create New Brand"}
        </h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium cursor-help ${
              healthScore.color === "success" ? "border-success/40 bg-success/10 text-success" :
              healthScore.color === "warning" ? "border-warning/40 bg-warning/10 text-warning" :
              "border-destructive/40 bg-destructive/10 text-destructive"
            }`}>
              <Sparkles className="h-3.5 w-3.5" />
              Brand Health: {healthScore.score}/100 · {healthScore.label}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1 text-xs">
              {healthScore.breakdown.map((b) => (
                <div key={b.signal} className="flex items-center justify-between gap-3">
                  <span className={b.ok ? "" : "text-muted-foreground"}>{b.ok ? "✓" : "○"} {b.signal}</span>
                  <span className="font-mono">{b.points}/{b.max}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Mood Pool Preview — mirrors generator's deriveBrandMoods exactly */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground mb-1.5">
                Allowed copy moods for this brand ({moodPool.allowed.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {moodPool.allowed.map((m) => (
                  <Badge key={m.label} variant="secondary" className="text-[10px] font-normal">{m.label}</Badge>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 italic">{moodPool.reason}</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    <p className="text-muted-foreground text-xs mt-0.5">Use clear markdown headers — these match the v3 Master Prompt and round-trip cleanly:<br />
                      <code className="bg-muted px-1 rounded text-xs">## BRAND IDENTITY</code> — what makes the brand unique<br />
                      <code className="bg-muted px-1 rounded text-xs">## MUST-INCLUDE ELEMENTS</code> — tagline, contact, legal text, RERA, etc.<br />
                      <code className="bg-muted px-1 rounded text-xs">## VISUAL DIRECTION</code> — most critical: mood, lighting, photography, layout, typography<br />
                      <code className="bg-muted px-1 rounded text-xs">## EXAMPLE COPY</code> — 3-5 strong sample headlines &amp; subcopy<br />
                      <code className="bg-muted px-1 rounded text-xs">## TONE &amp; VOICE</code> + <code className="bg-muted px-1 rounded text-xs">## TARGET AUDIENCE</code> — drive copy &amp; mood pool
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
              <div className="flex items-center justify-between gap-2">
                <Label>Industry</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={handleDetectIndustry}
                  disabled={detectingIndustry || !!industry}
                >
                  {detectingIndustry ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                  Auto-detect
                </Button>
              </div>
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
              {!industry && (
                <p className="text-xs text-warning">⚠ No industry set — asset tags fall back to generic vocabulary.</p>
              )}
              <p className="text-xs text-muted-foreground">Adds industry-specific asset tags (e.g., Elevation for Real Estate, Lookbook for Fashion).</p>
              {industry && assets.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs mt-1"
                  onClick={handleRetagAssets}
                  disabled={retaggingAssets}
                >
                  {retaggingAssets ? <Loader2 className="h-3 w-3 animate-spin" /> : <Tags className="h-3 w-3" />}
                  Re-tag all assets with {industry} vocabulary
                </Button>
              )}
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
                onChange={(e) => setBriefIdentity(e.target.value)}
                placeholder="Project name, location, parent company, USP, key differentiators..."
                rows={4}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{briefIdentity.length} chars — Be thorough; cover what makes the brand unique</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-mandatory">Must-Include Elements</Label>
              <Textarea
                id="brief-mandatory"
                value={briefMandatory}
                onChange={(e) => setBriefMandatory(e.target.value)}
                placeholder="Registrations, contact info, tagline, legal text, website URL..."
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{briefMandatory.length} chars — Compliance, contact, tagline, legal text</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-visual">Visual Direction</Label>
              <Textarea
                id="brief-visual"
                value={briefVisual}
                onChange={(e) => setBriefVisual(e.target.value)}
                placeholder="Mood, lighting, photography style, layout, typography — describe in as much detail as you need..."
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{briefVisual.length} chars — MOST CRITICAL — be hyper-specific</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-copy">Example Copy</Label>
              <Textarea
                id="brief-copy"
                value={briefCopy}
                onChange={(e) => setBriefCopy(e.target.value)}
                placeholder='Sample headlines, subcopy, CTAs the AI can use or adapt...'
                rows={3}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">{briefCopy.length} chars — 3-5 strong examples beat 10 mediocre ones</p>
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
                onChange={(e) => setVoiceRules(e.target.value)}
                placeholder='Voice traits, use-words / avoid-words, demographics, psychographics, desired emotional response...'
                rows={4}
              />
              <p className="text-xs text-muted-foreground">{voiceRules.length} chars</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="visual-nevers">Visual Nevers <span className="text-muted-foreground font-normal">(image / design constraints)</span></Label>
              <Textarea
                id="visual-nevers"
                value={visualNevers}
                onChange={(e) => setVisualNevers(e.target.value)}
                placeholder='"Never distort the logo. Never use stock photography. Never place text over key product imagery."'
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{visualNevers.length} chars — Drives image-prompt exclusions only</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="content-nevers">Content Nevers <span className="text-muted-foreground font-normal">(copywriting / messaging constraints)</span></Label>
              <Textarea
                id="content-nevers"
                value={contentNevers}
                onChange={(e) => setContentNevers(e.target.value)}
                placeholder='"Never use the word cheap. Never use fear-based urgency. Never omit mandatory legal text."'
                rows={3}
              />
              <p className="text-xs text-muted-foreground">{contentNevers.length} chars — Drives copy & mood derivation</p>
            </div>
            {legacyNevers && (
              <div className="space-y-2">
                <Label htmlFor="legacy-nevers" className="text-muted-foreground">Legacy Nevers <span className="text-[10px] font-normal">(unsplit — consider moving into Visual or Content above)</span></Label>
                <Textarea
                  id="legacy-nevers"
                  value={legacyNevers}
                  onChange={(e) => setLegacyNevers(e.target.value)}
                  rows={3}
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
