import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Save, Loader2, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";

interface AssetItem {
  id?: string;
  image_url: string;
  label: string;
  isNew?: boolean;
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
  const [voiceRules, setVoiceRules] = useState("");
  const [negativePrompts, setNegativePrompts] = useState("");
  const [brandBrief, setBrandBrief] = useState("");
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (isEditing) {
      // Fetch brand and assets in parallel
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
          setBrandBrief((data as any).brand_brief || "");
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
        // Insert directly into DB for existing brands
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
    // Reset input
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) {
      toast.error("Brand name is required.");
      return;
    }

    setLoading(true);
    const payload = {
      name,
      logo_url: assets.length > 0 ? assets[0].image_url : "",
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      brand_voice_rules: voiceRules,
      negative_prompts: negativePrompts,
      brand_brief: brandBrief,
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

      // Insert new assets linked to the new brand
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
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload logos, product photos, building shots, mascots, uniforms — any visual assets the AI should use when generating creatives. The first image will be used as the brand thumbnail.
            </p>

            {assets.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {assets.map((asset, index) => (
                  <div key={asset.id || index} className="relative group rounded-lg border border-border overflow-hidden bg-muted">
                    <div className="aspect-square">
                      <img src={asset.image_url} alt={asset.label || `Asset ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2">
                      <Input
                        value={asset.label}
                        onChange={(e) => handleLabelChange(index, e.target.value)}
                        placeholder={index === 0 ? "e.g., Logo" : "e.g., Building, Mascot"}
                        className="text-xs h-7"
                      />
                    </div>
                    {index === 0 && (
                      <span className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded font-medium">
                        Thumbnail
                      </span>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Color Palette</CardTitle>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Brand Brief / Guidelines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="brief">Paste your full brand brief, guidelines, or system prompt here</Label>
            <Textarea
              id="brief"
              value={brandBrief}
              onChange={(e) => setBrandBrief(e.target.value)}
              placeholder="Paste your complete brand guidelines, tone of voice, visual style, target audience, campaign details, typography rules, key messages, and any other brand information here..."
              rows={10}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Include everything the AI needs to know about your brand.
            </p>
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
          <Button type="submit" disabled={loading} className="gradient-primary hover:gradient-primary-hover text-primary-foreground px-8">
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isEditing ? "Save Changes" : "Create Brand"}
          </Button>
        </div>
      </form>
    </div>
  );
}
