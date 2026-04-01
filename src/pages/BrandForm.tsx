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

const ASSET_CATEGORIES = [
  "Logo",
  "Hero Image",
  "Architecture",
  "Lifestyle",
  "Masterplan",
  "Product",
  "Mascot",
  "Pattern/Texture",
  "Icon",
  "Other",
];

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
  const [negativePrompts, setNegativePrompts] = useState("");
  // Structured brief sections
  const [briefIdentity, setBriefIdentity] = useState("");
  const [briefMandatory, setBriefMandatory] = useState("");
  const [briefVisual, setBriefVisual] = useState("");
  const [briefCopy, setBriefCopy] = useState("");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  // Parse existing brand_brief into structured sections
  const parseBrief = (raw: string) => {
    const sections: Record<string, string> = { identity: "", mandatory: "", visual: "", copy: "" };
    const sectionMap: Record<string, keyof typeof sections> = {
      "brand identity": "identity",
      "must-include elements": "mandatory",
      "mandatory elements": "mandatory",
      "visual direction": "visual",
      "example copy": "copy",
      "copy examples": "copy",
    };
    let currentKey: keyof typeof sections | null = null;
    for (const line of raw.split("\n")) {
      const headerMatch = line.match(/^##\s+(.+)/);
      if (headerMatch) {
        const title = headerMatch[1].trim().toLowerCase();
        currentKey = sectionMap[title] || null;
        continue;
      }
      if (currentKey) {
        sections[currentKey] += (sections[currentKey] ? "\n" : "") + line;
      } else {
        // Lines before any header go to identity
        sections.identity += (sections.identity ? "\n" : "") + line;
      }
    }
    return {
      identity: sections.identity.trim(),
      mandatory: sections.mandatory.trim(),
      visual: sections.visual.trim(),
      copy: sections.copy.trim(),
    };
  };

  // Combine structured sections into a single brand_brief string
  const combineBrief = () => {
    const parts: string[] = [];
    if (briefIdentity.trim()) parts.push(`## Brand Identity\n${briefIdentity.trim()}`);
    if (briefMandatory.trim()) parts.push(`## Must-Include Elements\n${briefMandatory.trim()}`);
    if (briefVisual.trim()) parts.push(`## Visual Direction\n${briefVisual.trim()}`);
    if (briefCopy.trim()) parts.push(`## Example Copy\n${briefCopy.trim()}`);
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
          setNegativePrompts(data.negative_prompts || "");
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      negative_prompts: negativePrompts,
      brand_brief: combineBrief(),
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
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Shanti Juniors" />
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
                    <div className="p-2">
                      <Select
                        value={asset.label || ""}
                        onValueChange={(val) => {
                          handleLabelChange(index, val);
                          // Auto-save for existing assets
                          if (asset.id && isEditing) {
                            supabase
                              .from("brand_assets")
                              .update({ label: val })
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
                          {ASSET_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {index === 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Thumbnail
                      </span>
                    )}
                    {asset.label && (
                      <Badge variant="secondary" className="absolute top-1.5 right-8 text-[10px] bg-background/80 backdrop-blur-sm group-hover:hidden">
                        {asset.label}
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
                      onChange={(e) => updateExtraColor(index, "name", e.target.value)}
                      placeholder="e.g., Accent Gold"
                      className="text-sm flex-1"
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
                placeholder="Project name, location, developer, USP, key differentiators..."
                rows={4}
                className="text-sm"
              />
              <p className={`text-xs ${briefIdentity.length > 800 ? "text-amber-500" : "text-muted-foreground"}`}>{briefIdentity.length}/800 recommended — Project name, location, developer, USP</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-mandatory">Must-Include Elements</Label>
              <Textarea
                id="brief-mandatory"
                value={briefMandatory}
                onChange={(e) => setBriefMandatory(e.target.value)}
                placeholder="RERA number, contact info, tagline, legal text, website URL..."
                rows={3}
                className="text-sm"
              />
              <p className={`text-xs ${briefMandatory.length > 500 ? "text-amber-500" : "text-muted-foreground"}`}>{briefMandatory.length}/500 recommended — RERA, contact, tagline, legal text</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-visual">Visual Direction</Label>
              <Textarea
                id="brief-visual"
                value={briefVisual}
                onChange={(e) => setBriefVisual(e.target.value)}
                placeholder="Mood: premium & nature-led. Lighting: golden hour. Style: editorial photography. Layout: clean with breathing room..."
                rows={3}
                className="text-sm"
                maxLength={600}
              />
              <p className="text-xs text-muted-foreground">{briefVisual.length}/600 — Mood, lighting, photography style, layout preferences</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="brief-copy">Example Copy</Label>
              <Textarea
                id="brief-copy"
                value={briefCopy}
                onChange={(e) => setBriefCopy(e.target.value)}
                placeholder='Headlines: "Live Above The Ordinary" | CTAs: "Enquire Now", "Book a Site Visit" | Taglines: "Where Nature Meets Luxury"'
                rows={3}
                className="text-sm"
                maxLength={600}
              />
              <p className="text-xs text-muted-foreground">{briefCopy.length}/600 — Sample headlines, CTAs, taglines the AI can use or adapt</p>
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
                placeholder='"Subjects must strictly be 3-4 year old toddlers. Warm, nurturing tone."'
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="negative">The "Never" List (Strict Exclusions)</Label>
              <Textarea
                id="negative"
                value={negativePrompts}
                onChange={(e) => setNegativePrompts(e.target.value)}
                placeholder='"Never use the color green for real estate ads. Remove all background clutter."'
                rows={4}
              />
            </div>
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
