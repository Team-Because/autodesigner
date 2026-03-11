import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { generateBrandCreative, STEP_LABELS } from "@/lib/creative-engine";
import { GenerationStep, CreativeOutput } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Type,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

type StudioState = "idle" | "generating" | "complete";

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
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [campaignMessage, setCampaignMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [studioState, setStudioState] = useState<StudioState>("idle");
  const [currentStep, setCurrentStep] = useState<GenerationStep>("analyzing");
  const [progress, setProgress] = useState(0);
  const [creativeOutput, setCreativeOutput] = useState<CreativeOutput | null>(
    null
  );

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      setReferenceFile(file);
      setReferencePreview(URL.createObjectURL(file));
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFile(file);
      setReferencePreview(URL.createObjectURL(file));
    }
  };

  const handleGenerate = async () => {
    if (!selectedBrandId || !referenceFile || !user) {
      toast.error("Please select a brand and upload a reference image.");
      return;
    }

    setStudioState("generating");
    setProgress(0);

    // Upload reference image
    const ext = referenceFile.name.split(".").pop();
    const refPath = `${user.id}/ref-${crypto.randomUUID()}.${ext}`;
    await supabase.storage.from("brand-assets").upload(refPath, referenceFile);
    const { data: refUrlData } = supabase.storage
      .from("brand-assets")
      .getPublicUrl(refPath);

    // Create generation record
    const { data: gen, error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        brand_id: selectedBrandId,
        reference_image_url: refUrlData.publicUrl,
        campaign_message: campaignMessage,
        target_audience: targetAudience,
        status: "processing",
      })
      .select()
      .single();

    if (insertError || !gen) {
      toast.error("Failed to start generation.");
      setStudioState("idle");
      return;
    }

    try {
      const output = await generateBrandCreative(
        referenceFile,
        selectedBrandId,
        { message: campaignMessage, targetAudience },
        (step, prog) => {
          setCurrentStep(step);
          setProgress(prog);
        }
      );

      setCreativeOutput(output);
      setStudioState("complete");
      await supabase
        .from("generations")
        .update({
          output_image_url: output.imageUrl,
          layout_guide: output.layoutGuide,
          copywriting: output.copywriting as any,
          status: "completed",
        })
        .eq("id", gen.id);
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Creative generated successfully!");
    } catch {
      setStudioState("idle");
      await supabase
        .from("generations")
        .update({ status: "failed" })
        .eq("id", gen.id);
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.error("Generation failed. Please try again.");
    }
  };

  const handleReset = () => {
    setStudioState("idle");
    setCreativeOutput(null);
    setProgress(0);
    setReferenceFile(null);
    setReferencePreview("");
    setCampaignMessage("");
    setTargetAudience("");
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);
  const isGenerating = studioState === "generating";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">
          The Studio
        </h1>
        <p className="text-muted-foreground mt-1">
          One-click brand-aligned creative generation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ─── INPUT SECTION ─── */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">
                Select Brand
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedBrandId}
                onValueChange={setSelectedBrandId}
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">
                Reference Advertisement
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
                    Drop your reference advertisement here
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
                Campaign Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campaign-message">Campaign Message</Label>
                <Input
                  id="campaign-message"
                  value={campaignMessage}
                  onChange={(e) => setCampaignMessage(e.target.value)}
                  placeholder='e.g., "Open House — Admissions 2025"'
                  disabled={isGenerating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target-audience">Target Audience</Label>
                <Textarea
                  id="target-audience"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder='e.g., "Parents of 3-5 year olds in suburban areas"'
                  rows={2}
                  disabled={isGenerating}
                />
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
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />{" "}
                Generating...
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
                          {STEP_LABELS[currentStep]}
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
              {studioState === "complete" && creativeOutput && (
                <div className="w-full space-y-4">
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img
                      src={creativeOutput.imageUrl}
                      alt="Generated creative"
                      className="w-full aspect-video object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() =>
                        window.open(creativeOutput.imageUrl, "_blank")
                      }
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download Assets
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                      className="flex-1"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" /> Regenerate
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Copywriting & Layout Guide — shown after generation */}
          {studioState === "complete" && creativeOutput && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <Type className="h-4 w-4" /> Copywriting
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Headline
                    </p>
                    <p className="text-lg font-display font-bold text-foreground">
                      {creativeOutput.copywriting.headline}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Subline
                    </p>
                    <p className="text-sm text-foreground">
                      {creativeOutput.copywriting.subline}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                      Call to Action
                    </p>
                    <span className="inline-block px-4 py-2 rounded-md text-sm font-semibold gradient-primary text-primary-foreground">
                      {creativeOutput.copywriting.cta}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Layout Guide
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {creativeOutput.layoutGuide}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
