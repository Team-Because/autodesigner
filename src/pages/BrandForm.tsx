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
import { ArrowLeft, Upload, Save, Loader2, FileUp } from "lucide-react";
import { toast } from "sonner";

export default function BrandForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isEditing = id && id !== "new";

  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [brandKitUrl, setBrandKitUrl] = useState("");
  const [brandKitName, setBrandKitName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [secondaryColor, setSecondaryColor] = useState("#DBEAFE");
  const [voiceRules, setVoiceRules] = useState("");
  const [negativePrompts, setNegativePrompts] = useState("");
  const [brandBrief, setBrandBrief] = useState("");

  useEffect(() => {
    if (isEditing) {
      supabase
        .from("brands")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (data) {
            setName(data.name);
            setLogoUrl(data.logo_url || "");
            setLogoPreview(data.logo_url || "");
            setBrandKitUrl((data as any).brand_kit_url || "");
            if ((data as any).brand_kit_url) setBrandKitName("Brand Kit PDF");
            setPrimaryColor(data.primary_color);
            setSecondaryColor(data.secondary_color);
            setVoiceRules(data.brand_voice_rules || "");
            setNegativePrompts(data.negative_prompts || "");
            setBrandBrief((data as any).brand_brief || "");
          }
        });
    }
  }, [id, isEditing]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const ext = file.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("brand-assets")
      .upload(path, file);
    if (error) {
      toast.error("Failed to upload logo.");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(path);
    setLogoUrl(urlData.publicUrl);
    setLogoPreview(urlData.publicUrl);
  };

  const handleBrandKitUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const path = `${user.id}/kit-${crypto.randomUUID()}.pdf`;

    const { error } = await supabase.storage
      .from("brand-assets")
      .upload(path, file);
    if (error) {
      toast.error("Failed to upload brand kit.");
      return;
    }

    const { data: urlData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(path);
    setBrandKitUrl(urlData.publicUrl);
    setBrandKitName(file.name);
    toast.success("Brand kit uploaded.");
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
      logo_url: logoUrl,
      brand_kit_url: brandKitUrl,
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      brand_voice_rules: voiceRules,
      negative_prompts: negativePrompts,
      user_id: user.id,
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase
        .from("brands")
        .update(payload)
        .eq("id", id));
    } else {
      ({ error } = await supabase.from("brands").insert(payload));
    }

    setLoading(false);
    if (error) {
      toast.error("Failed to save brand.");
    } else {
      toast.success(
        `"${name}" ${isEditing ? "updated" : "created"} successfully.`
      );
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      navigate("/brands");
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <Button
        variant="ghost"
        onClick={() => navigate("/brands")}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Brand Hub
      </Button>

      <h1 className="text-2xl font-display font-bold">
        {isEditing ? "Edit Brand" : "Create New Brand"}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">
              Brand Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Brand Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Shanti Juniors"
              />
            </div>
            <div className="space-y-2">
              <Label>High-Res Logo (PNG)</Label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted border border-border">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <label className="flex-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Click to upload or drag & drop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG up to 10MB
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Brand Kit PDF</Label>
              <label className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors block">
                <FileUp className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                {brandKitName ? (
                  <p className="text-sm font-medium text-foreground">
                    {brandKitName}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Upload brand guidelines PDF
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  PDF up to 10MB
                </p>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleBrandKitUpload}
                  className="hidden"
                />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">
              Brand Color Palette
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primary">Primary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-12 rounded-md border border-input cursor-pointer"
                  />
                  <Input
                    id="primary"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary">Secondary Color</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-12 rounded-md border border-input cursor-pointer"
                  />
                  <Input
                    id="secondary"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">
              Communication Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice">
                Tone, Demographics & Target Audience
              </Label>
              <Textarea
                id="voice"
                value={voiceRules}
                onChange={(e) => setVoiceRules(e.target.value)}
                placeholder='e.g., "Subjects must strictly be 3-4 year old toddlers. Warm, nurturing tone."'
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="negative">
                The "Never" List (Strict Exclusions)
              </Label>
              <Textarea
                id="negative"
                value={negativePrompts}
                onChange={(e) => setNegativePrompts(e.target.value)}
                placeholder='e.g., "Never use the color green for real estate ads. Remove all background clutter. No location pin symbols."'
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading}
            className="gradient-primary hover:gradient-primary-hover text-primary-foreground px-8"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isEditing ? "Save Changes" : "Create Brand"}
          </Button>
        </div>
      </form>
    </div>
  );
}
