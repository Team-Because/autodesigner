import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  Sparkles,
  Download,
  RotateCcw,
  Loader2,
  RectangleHorizontal,
  Square,
  Smartphone,
  RectangleVertical,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type StudioState = "idle" | "generating" | "complete";

type OutputFormat = "landscape" | "square" | "story" | "portrait";

const FORMAT_OPTIONS: { value: OutputFormat; label: string; description: string; icon: typeof Square; aspect: string }[] = [
  { value: "landscape", label: "Landscape", description: "1920×1080 · Facebook, LinkedIn, Twitter", icon: RectangleHorizontal, aspect: "aspect-video" },
  { value: "square", label: "Square", description: "1080×1080 · Instagram Feed, Facebook", icon: Square, aspect: "aspect-square" },
  { value: "portrait", label: "Portrait", description: "1080×1350 · Instagram Feed, Pinterest", icon: RectangleVertical, aspect: "aspect-[4/5]" },
  { value: "story", label: "Story", description: "1080×1920 · Instagram & Facebook Stories, Reels", icon: Smartphone, aspect: "aspect-[9/16]" },
];

interface GenerationResult {
  imageUrl: string;
  caption: string;
  qc?: { passed: boolean; score: number; issues: string[] };
}

export default function Studio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("landscape");
  const [studioState, setStudioState] = useState<StudioState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);

  // Fetch campaigns for selected brand
  const { data: campaigns = [] } = useQuery({
    queryKey: ["campaigns", selectedBrandId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("brand_id", selectedBrandId)
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBrandId,
  });

  const setImageFile = useCallback((file: File) => {
    setReferenceFile(file);
    setReferencePreview(URL.createObjectURL(file));
  }, []);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      setImageFile(file);
    }
  }, [setImageFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setImageFile(file);
          return;
        }
      }
    }
  }, [setImageFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!selectedBrandId || !referenceFile || !user) {
      toast.error("Please select a brand and upload a reference image.");
      return;
    }

    setStudioState("generating");
    setProgress(5);
    setProgressPhase("Uploading reference image...");

    try {
      // Upload reference image
      const ext = referenceFile.name.split(".").pop();
      const refPath = `${user.id}/ref-${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("brand-assets")
        .upload(refPath, referenceFile);
      if (uploadErr) throw new Error("Failed to upload reference image");

      const { data: refUrlData } = supabase.storage
        .from("brand-assets")
        .getPublicUrl(refPath);

      setProgress(10);
      setProgressPhase("Creating generation record...");

      // Create generation record
      const { data: gen, error: insertError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          brand_id: selectedBrandId,
          campaign_id: selectedCampaignId || null,
          reference_image_url: refUrlData.publicUrl,
          status: "processing",
        } as any)
        .select()
        .single();

      if (insertError || !gen) throw new Error("Failed to create generation record");

      // Phase 1: Analyzing reference layout
      setProgress(15);
      setProgressPhase("Analyzing reference layout...");

      // Simulate progress during the long AI call
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 35) return prev + 1;
          if (prev < 85) return prev + 0.5;
          return prev;
        });
      }, 1500);

      // Phase transition after ~8 seconds (analysis should be done)
      const phaseTimeout = setTimeout(() => {
        setProgressPhase("Generating brand creative...");
      }, 8000);

      // Call the backend function with controlled retry only for retryable overloads
      let fnData: any = null;
      let fnError: any = null;
      let invokeErrorMessage = "";
      const maxInvokeAttempts = 3;

      for (let invokeAttempt = 1; invokeAttempt <= maxInvokeAttempts; invokeAttempt++) {
        const response = await supabase.functions.invoke("generate-creative", {
          body: {
            brandId: selectedBrandId,
            campaignId: selectedCampaignId || undefined,
            referenceImageUrl: refUrlData.publicUrl,
            generationId: gen.id,
            outputFormat,
          },
        });

        fnData = response.data;
        fnError = response.error;

        if (!fnError) break;

        let errorMessage = fnError.message || "Generation failed";
        const context = (fnError as any).context;
        let retryable = false;
        let retryAfterSeconds = 0;

        if (context?.json) {
          try {
            const payload = await context.json();
            if (payload?.error) errorMessage = payload.error;
            retryable = !!payload?.retryable;
            retryAfterSeconds = Number(payload?.retryAfterSeconds || 0);
          } catch {
            // ignore JSON parse failure
          }
        }

        const isRetryableOverload =
          (context?.status === 503 || context?.status === 429) && retryable;

        if (isRetryableOverload && invokeAttempt < maxInvokeAttempts) {
          const waitMs = Math.max(retryAfterSeconds * 1000, 45000);
          setProgressPhase(`AI providers are busy — retrying in ${Math.ceil(waitMs / 1000)}s...`);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        invokeErrorMessage = errorMessage;
        break;
      }

      clearInterval(progressInterval);
      clearTimeout(phaseTimeout);

      if (invokeErrorMessage || fnError) {
        throw new Error(invokeErrorMessage || "Generation failed");
      }

      if (fnData?.error) {
        throw new Error(fnData.error);
      }

      setProgress(100);
      setProgressPhase("Complete!");
      setResult({
        imageUrl: fnData.imageUrl,
        caption: fnData.caption,
        qc: fnData.qc || undefined,
      });
      setStudioState("complete");

      // Safety net: update generation record from client side in case edge function DB update failed
      if (fnData.imageUrl && gen.id) {
        await supabase
          .from("generations")
          .update({
            output_image_url: fnData.imageUrl,
            copywriting: fnData.caption ? { caption: fnData.caption } : undefined,
            status: "completed",
          })
          .eq("id", gen.id);
      }

      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Creative generated successfully!");
    } catch (err: any) {
      console.error("Generation error:", err);
      setStudioState("idle");
      setProgress(0);
      setProgressPhase("");
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.error(err.message || "Generation failed. Please try again.");
    }
  };

  const handleReset = () => {
    setStudioState("idle");
    setResult(null);
    setProgress(0);
    setProgressPhase("");
    setReferenceFile(null);
    setReferencePreview("");
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);
  const isGenerating = studioState === "generating";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto" onPaste={handlePaste} tabIndex={-1}>
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">
          The Studio
        </h1>
        <p className="text-muted-foreground mt-1">
          Select a brand, upload a reference ad, and get a brand-aligned
          creative instantly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ─── INPUT SECTION ─── */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">
                1. Select Brand
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedBrandId}
                onValueChange={(val) => {
                  setSelectedBrandId(val);
                  setSelectedCampaignId("");
                }}
                disabled={isGenerating}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a brand profile..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        {b.logo_url ? (
                          <img
                            src={b.logo_url}
                            alt=""
                            className="h-5 w-5 rounded object-cover"
                          />
                        ) : null}
                        <span>{b.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBrand && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedBrand.primary_color }}
                  />
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: selectedBrand.secondary_color }}
                  />
                  <span>
                    {selectedBrand.primary_color} /{" "}
                    {selectedBrand.secondary_color}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Campaign Selector (optional) */}
          {selectedBrandId && campaigns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-display">
                  Campaign <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedCampaignId || "none"}
                  onValueChange={(val) => setSelectedCampaignId(val === "none" ? "" : val)}
                  disabled={isGenerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No campaign — use brand defaults" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign — brand defaults</SelectItem>
                    {campaigns.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">
                2. Upload Reference Ad
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referencePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img
                    src={referencePreview}
                    alt="Reference"
                    className="w-full aspect-video object-cover"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setReferenceFile(null);
                      setReferencePreview("");
                    }}
                    disabled={isGenerating}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <label
                  className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">
                    Drop or paste your reference advertisement here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse — PNG, JPG, WebP
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">
                3. Output Format
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FORMAT_OPTIONS.map((fmt) => (
                  <button
                    key={fmt.value}
                    type="button"
                    disabled={isGenerating}
                    onClick={() => setOutputFormat(fmt.value)}
                    className={`relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all text-center ${
                      outputFormat === fmt.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/30 hover:bg-accent/30"
                    } ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <fmt.icon className={`h-6 w-6 ${outputFormat === fmt.value ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-sm font-medium ${outputFormat === fmt.value ? "text-primary" : "text-foreground"}`}>
                      {fmt.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {fmt.description}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Button
            className="w-full h-12 text-base gradient-primary hover:gradient-primary-hover text-primary-foreground font-semibold"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedBrandId || !referenceFile}
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5 mr-2" /> Generate Creative
              </>
            )}
          </Button>
        </div>

        {/* ─── OUTPUT SECTION ─── */}
        <div className="space-y-5">
          <Card className="min-h-[400px] flex flex-col">
            <CardHeader>
              <CardTitle className="text-base font-display">Output</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              {studioState === "idle" && (
                <div className="text-center text-muted-foreground py-16">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">
                    Select a brand and upload a reference to begin.
                  </p>
                </div>
              )}
              {studioState === "generating" && (
                <div className="w-full space-y-6 py-8">
                  <div className="relative w-full aspect-video rounded-lg bg-muted overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center px-4">
                        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-sm font-medium text-foreground animate-pulse-glow">
                          {progressPhase || "Generating your brand creative..."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          This may take 30–60 seconds
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">
                      {progress}%
                    </p>
                  </div>
                </div>
              )}
              {studioState === "complete" && result && (
                <div className="w-full space-y-4">
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img
                      src={result.imageUrl}
                      alt="Generated creative"
                      className="w-full"
                    />
                  </div>
                  {result.caption && (
                    <Card>
                      <CardContent className="pt-4">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          AI Caption / Copy
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                          {result.caption}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  <div className="flex gap-3">
                    <Button
                      onClick={() => window.open(result.imageUrl, "_blank")}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> New Creative
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
