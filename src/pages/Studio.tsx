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
  Zap,
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
  { value: "landscape", label: "Landscape", description: "1920×1080 · 16:9", icon: RectangleHorizontal, aspect: "aspect-video" },
  { value: "square", label: "Square", description: "1080×1080 · 1:1", icon: Square, aspect: "aspect-square" },
  { value: "portrait", label: "Portrait", description: "1080×1350 · 4:5", icon: RectangleVertical, aspect: "aspect-[4/5]" },
  { value: "story", label: "Story", description: "1080×1920 · 9:16", icon: Smartphone, aspect: "aspect-[9/16]" },
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

  const { data: credits, refetch: refetchCredits } = useQuery({
    queryKey: ["user-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_credits")
        .select("credits_remaining, credits_used")
        .eq("user_id", user!.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("landscape");
  const [studioState, setStudioState] = useState<StudioState>("idle");
  const [progress, setProgress] = useState(0);
  const [progressPhase, setProgressPhase] = useState("");
  const [result, setResult] = useState<GenerationResult | null>(null);


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

    if (credits && credits.credits_remaining <= 0) {
      toast.error("No credits remaining. Contact your admin to add more.");
      return;
    }

    setStudioState("generating");
    setProgress(5);
    setProgressPhase("Uploading reference image...");

    try {
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

      const { data: gen, error: insertError } = await supabase
        .from("generations")
        .insert({
          user_id: user.id,
          brand_id: selectedBrandId,
          reference_image_url: refUrlData.publicUrl,
          status: "processing",
        } as any)
        .select()
        .single();

      if (insertError || !gen) throw new Error("Failed to create generation record");

      setProgress(15);
      setProgressPhase("Analyzing reference layout...");

      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev < 35) return prev + 1;
          if (prev < 85) return prev + 0.5;
          return prev;
        });
      }, 1500);

      const phaseTimeout1 = setTimeout(() => {
        setProgressPhase("Refining creative brief...");
      }, 6000);

      const phaseTimeout15 = setTimeout(() => {
        setProgressPhase("Generating brand creative...");
      }, 12000);

      const phaseTimeout2 = setTimeout(() => {
        setProgressPhase("Quality checking output...");
        setProgress((prev) => Math.max(prev, 88));
      }, 40000);

      let fnData: any = null;
      let fnError: any = null;
      let invokeErrorMessage = "";
      const maxInvokeAttempts = 3;

      for (let invokeAttempt = 1; invokeAttempt <= maxInvokeAttempts; invokeAttempt++) {
        const response = await supabase.functions.invoke("generate-creative", {
          body: {
            brandId: selectedBrandId,
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
        let qcIssues: string[] = [];

        if (context) {
          try {
            const rawText = typeof context.text === "function" ? await context.text() : "";
            if (rawText) {
              const payload = JSON.parse(rawText);
              if (payload?.error) errorMessage = payload.error;
              retryable = !!payload?.retryable;
              retryAfterSeconds = Number(payload?.retryAfterSeconds || 0);
              qcIssues = Array.isArray(payload?.qc?.issues)
                ? payload.qc.issues.filter((issue: unknown): issue is string => typeof issue === "string")
                : [];
            }
          } catch {
            // ignore
          }
        }

        const isRetryableOverload =
          (context?.status === 503 || context?.status === 429) && retryable;

        if (context?.status === 422) {
          invokeErrorMessage = qcIssues.length > 0
            ? `${errorMessage}\n\nMain issues:\n• ${qcIssues.slice(0, 3).join("\n• ")}`
            : errorMessage;
          break;
        }

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
      clearTimeout(phaseTimeout1);
      clearTimeout(phaseTimeout15);
      clearTimeout(phaseTimeout2);

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

      if (fnData.imageUrl && gen.id) {
        await supabase
          .from("generations")
          .update({
            output_image_url: fnData.imageUrl,
            copywriting: {
              caption: fnData.caption,
              ...(fnData.qc ? { qc: fnData.qc } : {}),
            },
            status: "completed",
          })
          .eq("id", gen.id);
      }

      queryClient.invalidateQueries({ queryKey: ["generations"] });
      refetchCredits();
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
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in" onPaste={handlePaste} tabIndex={-1}>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
            Studio
          </h1>
          <p className="text-muted-foreground mt-1">
            Upload a reference, pick your brand, and generate.
          </p>
        </div>
        {credits && (
          <Badge
            variant={credits.credits_remaining > 0 ? "secondary" : "destructive"}
            className="text-sm px-4 py-1.5 rounded-xl font-semibold"
          >
            {credits.credits_remaining} credit{credits.credits_remaining !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ─── INPUT ─── */}
        <div className="space-y-5">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display font-semibold uppercase tracking-wider text-muted-foreground">
                1 · Brand
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedBrandId}
                onValueChange={setSelectedBrandId}
                disabled={isGenerating}
              >
                <SelectTrigger className="rounded-xl h-11 bg-muted/30 border-border/50">
                  <SelectValue placeholder="Choose a brand profile..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        {b.logo_url ? (
                          <img src={b.logo_url} alt="" className="h-5 w-5 rounded object-cover" />
                        ) : null}
                        <span>{b.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBrand && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-4 w-4 rounded-full ring-1 ring-border" style={{ backgroundColor: selectedBrand.primary_color }} />
                  <div className="h-4 w-4 rounded-full ring-1 ring-border" style={{ backgroundColor: selectedBrand.secondary_color }} />
                  <span className="font-medium">{selectedBrand.primary_color} / {selectedBrand.secondary_color}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display font-semibold uppercase tracking-wider text-muted-foreground">
                2 · Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              {referencePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border/50">
                  <img src={referencePreview} alt="Reference" className="w-full aspect-video object-cover" />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute top-2 right-2 rounded-lg"
                    onClick={() => { setReferenceFile(null); setReferencePreview(""); }}
                    disabled={isGenerating}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <label
                  className="border-2 border-dashed border-border/50 rounded-2xl p-10 flex flex-col items-center cursor-pointer hover:border-primary/40 hover:bg-accent/30 transition-all duration-300"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleFileDrop}
                >
                  <div className="h-14 w-14 rounded-2xl bg-accent flex items-center justify-center mb-4">
                    <Upload className="h-6 w-6 text-accent-foreground" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Drop or paste your reference ad
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse — PNG, JPG, WebP
                  </p>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display font-semibold uppercase tracking-wider text-muted-foreground">
                3 · Format
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
                    className={`relative flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all duration-200 text-center ${
                      outputFormat === fmt.value
                        ? "border-primary bg-accent shadow-sm glow-sm"
                        : "border-border/50 hover:border-primary/30 hover:bg-accent/30"
                    } ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <fmt.icon className={`h-6 w-6 ${outputFormat === fmt.value ? "text-primary" : "text-muted-foreground"}`} />
                    <span className={`text-xs font-semibold ${outputFormat === fmt.value ? "text-primary" : "text-foreground"}`}>
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
            className="w-full h-13 text-base rounded-xl gradient-primary hover:gradient-primary-hover text-primary-foreground font-bold glow-sm"
            onClick={handleGenerate}
            disabled={isGenerating || !selectedBrandId || !referenceFile}
          >
            {isGenerating ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating...</>
            ) : (
              <><Zap className="h-5 w-5 mr-2" /> Generate Creative</>
            )}
          </Button>
        </div>

        {/* ─── OUTPUT ─── */}
        <div className="space-y-5">
          <Card className="glass-card min-h-[400px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display font-semibold uppercase tracking-wider text-muted-foreground">Output</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              {studioState === "idle" && (
                <div className="text-center text-muted-foreground py-16">
                  <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                    <Zap className="h-8 w-8 opacity-30" />
                  </div>
                  <p className="text-sm font-medium">Your creative will appear here.</p>
                </div>
              )}
              {studioState === "generating" && (
                <div className="w-full space-y-6 py-8">
                  <div className="relative w-full aspect-video rounded-2xl bg-muted/30 overflow-hidden border border-border/30">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center px-4">
                        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-sm font-semibold text-foreground animate-pulse-glow">
                          {progressPhase || "Generating your brand creative..."}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          This may take 30–60 seconds
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2 rounded-full" />
                    <p className="text-xs text-muted-foreground text-right font-medium">
                      {Math.round(progress)}%
                    </p>
                  </div>
                </div>
              )}
              {studioState === "complete" && result && (
                <div className="w-full space-y-4">
                  <div className="rounded-2xl overflow-hidden border border-border/30 relative shadow-lg">
                    <img src={result.imageUrl} alt="Generated creative" className="w-full" />
                    {result.qc && (
                      <div className="absolute top-3 right-3">
                        <Badge
                          variant={result.qc.score >= 70 ? "default" : "destructive"}
                          className="gap-1 text-xs rounded-lg"
                        >
                          {result.qc.score >= 70 ? (
                            <><CheckCircle2 className="h-3 w-3" /> QC {result.qc.score}/100</>
                          ) : (
                            <><AlertTriangle className="h-3 w-3" /> QC {result.qc.score}/100</>
                          )}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {result.caption && (
                    <Card className="glass-card">
                      <CardContent className="pt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          AI Caption
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
                      className="flex-1 rounded-xl h-11 gradient-primary hover:gradient-primary-hover text-primary-foreground font-semibold"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setResult(null);
                        setStudioState("idle");
                        setProgress(0);
                        setProgressPhase("");
                        // Keep brand + reference + format selected, just re-trigger
                        setTimeout(() => handleGenerate(), 50);
                      }}
                      className="rounded-xl h-11 font-semibold px-5"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Retry
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="rounded-xl h-11 font-semibold px-5"
                    >
                      New
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
