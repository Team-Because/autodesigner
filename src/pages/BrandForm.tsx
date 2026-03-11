import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useBrandStore } from "@/lib/brand-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Save } from "lucide-react";
import { toast } from "sonner";

export default function BrandForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getBrand, addBrand, updateBrand } = useBrandStore();
  const isEditing = id && id !== "new";

  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2563EB");
  const [secondaryColor, setSecondaryColor] = useState("#DBEAFE");
  const [voiceRules, setVoiceRules] = useState("");
  const [negativePrompts, setNegativePrompts] = useState("");

  useEffect(() => {
    if (isEditing) {
      const brand = getBrand(id);
      if (brand) {
        setName(brand.name);
        setLogoUrl(brand.logo_url);
        setLogoPreview(brand.logo_url);
        setPrimaryColor(brand.primary_color);
        setSecondaryColor(brand.secondary_color);
        setVoiceRules(brand.brand_voice_rules);
        setNegativePrompts(brand.negative_prompts);
      }
    }
  }, [id, isEditing, getBrand]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setLogoPreview(url);
      setLogoUrl(url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Brand name is required.");
      return;
    }

    const data = {
      name,
      logo_url: logoUrl || "https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100&h=100&fit=crop",
      primary_color: primaryColor,
      secondary_color: secondaryColor,
      brand_voice_rules: voiceRules,
      negative_prompts: negativePrompts,
    };

    if (isEditing) {
      updateBrand(id, data);
      toast.success(`"${name}" updated successfully.`);
    } else {
      addBrand(data);
      toast.success(`"${name}" created successfully.`);
    }
    navigate("/brands");
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
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., TinySteps Academy" />
            </div>

            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted border border-border">
                    <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                  </div>
                )}
                <label className="flex-1 border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                  <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Click to upload or drag & drop</p>
                  <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 10MB</p>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-display">Visual Guardrails</CardTitle>
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
            <CardTitle className="text-base font-display">Brand Voice & Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="voice">Brand Voice & Subject Rules</Label>
              <Textarea
                id="voice"
                value={voiceRules}
                onChange={(e) => setVoiceRules(e.target.value)}
                placeholder='e.g., "Subjects must strictly be 3-4 year old toddlers, not older kids." "Warm, nurturing tone. Bright classroom settings only."'
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="negative">The "Never" List (Negative Prompts)</Label>
              <Textarea
                id="negative"
                value={negativePrompts}
                onChange={(e) => setNegativePrompts(e.target.value)}
                placeholder='e.g., "Never use the color green for real estate ads." "No location pin symbols." "Remove all background clutter." "No hallucinated text or watermarks."'
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" className="gradient-primary hover:gradient-primary-hover text-primary-foreground px-8">
            <Save className="h-4 w-4 mr-2" /> {isEditing ? "Save Changes" : "Create Brand"}
          </Button>
        </div>
      </form>
    </div>
  );
}
