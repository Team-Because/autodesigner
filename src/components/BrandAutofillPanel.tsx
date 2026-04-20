import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Sparkles, Loader2, ChevronDown, X, ImagePlus, Wand2 } from "lucide-react";
import { toast } from "sonner";

export interface AutofillResult {
  industry: string;
  primary_color: string;
  secondary_color: string;
  extra_colors: { name: string; hex: string }[];
  brief_identity: string;
  brief_mandatory: string;
  brief_visual: string;
  brief_copy: string;
  brand_voice_rules: string;
  negative_prompts: string;
  asset_tags: { index: number; tag: string; reasoning?: string }[];
  confidence: "high" | "medium" | "low";
  // Uploaded assets, in the order they were sent to the AI. First = logo if provided.
  uploaded_assets: { image_url: string; predicted_tag: string }[];
}

interface Props {
  brandNameHint: string;
  onApply: (result: AutofillResult) => void;
}

interface PendingImage {
  file: File;
  previewUrl: string;
  uploadedUrl?: string;
}

export default function BrandAutofillPanel({ brandNameHint, onApply }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [logo, setLogo] = useState<PendingImage | null>(null);
  const [refs, setRefs] = useState<PendingImage[]>([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [stage, setStage] = useState<string>("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const refsInputRef = useRef<HTMLInputElement>(null);

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logo?.previewUrl) URL.revokeObjectURL(logo.previewUrl);
    setLogo({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const handleRefsSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newRefs: PendingImage[] = Array.from(files).slice(0, 6 - refs.length).map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
    }));
    setRefs((prev) => [...prev, ...newRefs]);
    e.target.value = "";
  };

  const removeRef = (i: number) => {
    setRefs((prev) => {
      const next = [...prev];
      const removed = next.splice(i, 1)[0];
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  };

  const removeLogo = () => {
    if (logo?.previewUrl) URL.revokeObjectURL(logo.previewUrl);
    setLogo(null);
  };

  const uploadOne = async (file: File): Promise<string | null> => {
    if (!user) return null;
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/autofill/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file);
    if (error) {
      console.error("upload error", error);
      return null;
    }
    return supabase.storage.from("brand-assets").getPublicUrl(path).data.publicUrl;
  };

  const analyze = async () => {
    if (!user) {
      toast.error("Please sign in.");
      return;
    }
    if (!logo && refs.length === 0 && !websiteUrl.trim()) {
      toast.error("Add a logo, at least one reference image, or a website URL.");
      return;
    }

    setAnalyzing(true);
    try {
      // 1. Upload all images to storage so the AI can fetch them.
      setStage("Uploading assets…");
      const uploadedAssets: { image_url: string; predicted_tag: string }[] = [];
      let logoUrl: string | undefined;
      if (logo) {
        const url = await uploadOne(logo.file);
        if (!url) throw new Error("Failed to upload logo.");
        logoUrl = url;
        uploadedAssets.push({ image_url: url, predicted_tag: "Logo" });
      }
      const refUrls: string[] = [];
      for (const r of refs) {
        const url = await uploadOne(r.file);
        if (url) {
          refUrls.push(url);
          uploadedAssets.push({ image_url: url, predicted_tag: "" });
        }
      }

      // 2. Call AI.
      setStage("Analyzing with AI…");
      const { data, error } = await supabase.functions.invoke("brand-autofill", {
        body: {
          logo_url: logoUrl,
          reference_urls: refUrls,
          website_url: websiteUrl.trim() || undefined,
          brand_name_hint: brandNameHint || undefined,
        },
      });

      if (error) {
        // Try to surface server-provided error message.
        const msg = (error as { message?: string }).message || "AI analysis failed.";
        if (msg.includes("Rate") || msg.includes("429")) {
          toast.error("Rate limited — try again in a moment.");
        } else if (msg.includes("credits") || msg.includes("402")) {
          toast.error("AI credits exhausted. Add funds in workspace settings.");
        } else {
          toast.error(msg);
        }
        return;
      }

      if (!data || (data as { error?: string }).error) {
        toast.error((data as { error?: string })?.error || "No result from AI.");
        return;
      }

      const result = data as Omit<AutofillResult, "uploaded_assets">;

      // 3. Merge predicted tags onto uploaded assets in order.
      for (const tag of result.asset_tags || []) {
        if (typeof tag.index === "number" && uploadedAssets[tag.index]) {
          // Don't overwrite the logo tag we set ourselves.
          if (uploadedAssets[tag.index].predicted_tag !== "Logo") {
            uploadedAssets[tag.index].predicted_tag = tag.tag || "";
          }
        }
      }

      setStage("Applying to form…");
      onApply({ ...result, uploaded_assets: uploadedAssets });

      const conf = result.confidence || "medium";
      toast.success(
        `Brand profile auto-filled (${conf} confidence). Review and edit before saving.`,
        { duration: 5000 }
      );

      // Reset panel state on success.
      removeLogo();
      refs.forEach((r) => URL.revokeObjectURL(r.previewUrl));
      setRefs([]);
      setWebsiteUrl("");
      setOpen(false);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAnalyzing(false);
      setStage("");
    }
  };

  const totalImages = (logo ? 1 : 0) + refs.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-secondary/10">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-primary/5 transition-colors rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    Auto-fill from assets
                    <Badge variant="secondary" className="text-[10px] h-5 bg-primary/10 text-primary border-primary/20">AI</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upload your logo, references, or paste a URL — we'll fill the brand profile for you.
                  </CardDescription>
                </div>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-5">
            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Logo</Label>
              {logo ? (
                <div className="relative inline-block">
                  <img src={logo.previewUrl} alt="Logo preview" className="h-20 w-20 rounded-lg border border-border object-contain bg-muted" />
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-1"
                    aria-label="Remove logo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="h-20 w-20 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/50 transition-colors flex flex-col items-center justify-center text-muted-foreground"
                >
                  <ImagePlus className="h-5 w-5 mb-0.5" />
                  <span className="text-[10px]">Add logo</span>
                </button>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoSelect} className="hidden" />
            </div>

            {/* References */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Reference creatives <span className="text-muted-foreground font-normal">(up to 6)</span></Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {refs.map((r, i) => (
                  <div key={i} className="relative aspect-square rounded-lg border border-border overflow-hidden bg-muted">
                    <img src={r.previewUrl} alt={`Reference ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-0.5"
                      aria-label="Remove reference"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {refs.length < 6 && (
                  <button
                    type="button"
                    onClick={() => refsInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-accent/50 transition-colors flex flex-col items-center justify-center text-muted-foreground"
                  >
                    <ImagePlus className="h-4 w-4 mb-0.5" />
                    <span className="text-[10px]">Add</span>
                  </button>
                )}
              </div>
              <input ref={refsInputRef} type="file" accept="image/*" multiple onChange={handleRefsSelect} className="hidden" />
            </div>

            {/* Website URL */}
            <div className="space-y-2">
              <Label htmlFor="autofill-url" className="text-xs font-semibold">
                Website URL <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="autofill-url"
                type="url"
                placeholder="https://your-brand.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                className="text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                We'll fetch headlines, meta tags, and the OG image for visual analysis.
              </p>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-muted-foreground">
                {totalImages > 0 ? `${totalImages} image${totalImages === 1 ? "" : "s"}` : "No images yet"}
                {websiteUrl.trim() && " • URL will be scraped"}
              </p>
              <Button
                type="button"
                onClick={analyze}
                disabled={analyzing || (!logo && refs.length === 0 && !websiteUrl.trim())}
                className="gap-1.5"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {stage || "Analyzing…"}
                  </>
                ) : (
                  <>
                    <Wand2 className="h-3.5 w-3.5" />
                    Analyze & Fill
                  </>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-muted-foreground border-t border-border/50 pt-3">
              ✨ Existing field values are preserved. Only empty fields get auto-filled. Uploaded assets are added to your asset library — you can re-tag or delete them after.
            </p>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
