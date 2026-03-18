import { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Save, Loader2, X, ImagePlus, Plus, ChevronDown, Lightbulb, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import BrandProfileSections from "@/components/BrandProfileSections";
import { parse, serialize, EMPTY_PROFILE, type StructuredBrandProfile } from "@/lib/brandProfileSerializer";

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
  const [profile, setProfile] = useState<StructuredBrandProfile>({ ...EMPTY_PROFILE });
  const [legacyBrief, setLegacyBrief] = useState("");
  const [isLegacy, setIsLegacy] = useState(false);
  const [voiceRules, setVoiceRules] = useState("");
  const [negativePrompts, setNegativePrompts] = useState("");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

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

          // Parse structured profile
          const brief = (data as any).brand_brief || "";
          const parsed = parse(brief);
          if (parsed.structured) {
            setProfile(parsed.profile);
            setIsLegacy(false);
          } else {
            setLegacyBrief(brief);
            setIsLegacy(!!brief);
          }

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

    let brandBrief: string;
    let finalVoiceRules: string;
    let finalNegativePrompts: string;

    if (isLegacy) {
      brandBrief = legacyBrief;
      finalVoiceRules = voiceRules;
      finalNegativePrompts = negativePrompts;
    } else {
      const serialized = serialize(profile);
      brandBrief = serialized.brand_brief;
      finalVoiceRules = serialized.brand_voice_rules;
      finalNegativePrompts = serialized.negative_prompts;
    }

    const payload: any = {
      name,
      logo_url: assets.length > 0 ? assets[0].image_url : "",
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      extra_colors: extraColors,
      brand_voice_rules: finalVoiceRules,
      negative_prompts: finalNegativePrompts,
      brand_brief: brandBrief,
      user_id: user.id,
    };

    let brandId = id;
    let error;

    if (isEditing) {
      ({ error } = await supabase.from("brands").update(payload).eq("id", id));
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
                    <p className="font-medium">Fill each guided section below</p>
                    <p className="text-muted-foreground text-xs mt-0.5">The form maps directly to the AI's understanding. Structured input = consistent output.</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Upload & tag all visual assets</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Upload logos, renders, product shots, mascots. Tag each one so the AI knows how to use them.</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Separate "Visual Nevers" from "Content Nevers"</p>
                    <p className="text-muted-foreground text-xs mt-0.5">In Do's & Don'ts section, keep visual and content constraints separate.</p>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Group brands into campaigns</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Duplicate and customize brands for different objectives, then group them together.</p>
                  </div>
                </div>
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
            <CardDescription>Upload logos, product photos, building shots, mascots — tag each so the AI knows its role.</CardDescription>
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
                          if (asset.id && isEditing) {
                            supabase.from("brand_assets").update({ label: val }).eq("id", asset.id).then(({ error }) => {
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
              <input type="file" accept="image/*" multiple onChange={handleAssetUpload} className="hidden" disabled={uploading} />
            </label>
          </CardContent>
        </Card>

        {/* Color Palette */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Color Palette</CardTitle>
            <CardDescription>Define your complete palette. Name each color for context.</CardDescription>
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

            {extraColors.length > 0 && (
              <div className="space-y-3 pt-2">
                <Label className="text-xs text-muted-foreground">Additional Colors</Label>
                {extraColors.map((color, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input type="color" value={color.hex} onChange={(e) => updateExtraColor(index, "hex", e.target.value)} className="h-9 w-10 rounded-md border border-input cursor-pointer shrink-0" />
                    <Input value={color.hex} onChange={(e) => updateExtraColor(index, "hex", e.target.value)} className="font-mono text-sm w-28 shrink-0" />
                    <Input value={color.name} onChange={(e) => updateExtraColor(index, "name", e.target.value)} placeholder="e.g., Accent Gold" className="text-sm flex-1" />
                    <button type="button" onClick={() => removeExtraColor(index)} className="text-muted-foreground hover:text-destructive transition-colors p-1">
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

        {/* Brand Profile */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display">Brand Brief</CardTitle>
              {isLegacy && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsLegacy(false); setLegacyBrief(""); }}
                  className="text-xs"
                >
                  Switch to Guided Form
                </Button>
              )}
            </div>
            <CardDescription>
              {isLegacy
                ? "Legacy free-text format. Switch to the guided form for better AI results."
                : "Fill what's relevant, skip what's not. Each field maps directly to the AI prompt."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLegacy ? (
              <div className="space-y-2">
                <Textarea
                  value={legacyBrief}
                  onChange={(e) => setLegacyBrief(e.target.value)}
                  placeholder="Paste your complete brand guidelines here..."
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            ) : (
              <BrandProfileSections profile={profile} onChange={setProfile} />
            )}
          </CardContent>
        </Card>
        <div className="flex justify-end">
          <Button type="submit" disabled={loading} className="gradient-primary hover:gradient-primary-hover text-primary-foreground px-8">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Save Changes" : "Create Brand"}
          </Button>
        </div>
      </form>
    </div>
  );
}
