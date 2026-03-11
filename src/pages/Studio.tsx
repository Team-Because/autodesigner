import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { generateBrandCreative, STEP_LABELS } from "@/lib/ai-pipeline";
import { GenerationStep } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Upload, Sparkles, Download, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";

type StudioState = "idle" | "generating" | "complete";

export default function Studio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState("");
  const [studioState, setStudioState] = useState<StudioState>("idle");
  const [currentStep, setCurrentStep] = useState<GenerationStep>("analyzing");
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState("");

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
    const { data: refUrlData } = supabase.storage.from("brand-assets").getPublicUrl(refPath);

    // Create generation record
    const { data: gen, error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        brand_id: selectedBrandId,
        reference_image_url: refUrlData.publicUrl,
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
      const url = await generateBrandCreative(referenceFile, selectedBrandId, (step, prog) => {
        setCurrentStep(step);
        setProgress(prog);
      });

      setOutputUrl(url);
      setStudioState("complete");
      await supabase.from("generations").update({ output_image_url: url, status: "completed" }).eq("id", gen.id);
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.success("Creative generated successfully!");
    } catch {
      setStudioState("idle");
      await supabase.from("generations").update({ status: "failed" }).eq("id", gen.id);
      queryClient.invalidateQueries({ queryKey: ["generations"] });
      toast.error("Generation failed. Please try again.");
    }
  };

  const handleReset = () => {
    setStudioState("idle");
    setOutputUrl("");
    setProgress(0);
    setReferenceFile(null);
    setReferencePreview("");
  };

  const selectedBrand = brands.find((b) => b.id === selectedBrandId);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">The Studio</h1>
        <p className="text-muted-foreground mt-1">One-click brand-aligned creative generation.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base font-display">Select Brand</CardTitle></CardHeader>
            <CardContent>
              <Select value={selectedBrandId} onValueChange={setSelectedBrandId} disabled={studioState === "generating"}>
                <SelectTrigger><SelectValue placeholder="Choose a brand profile..." /></SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      <div className="flex items-center gap-2">
                        {b.logo_url ? <img src={b.logo_url} alt="" className="h-5 w-5 rounded object-cover" /> : null}
                        <span>{b.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBrand && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedBrand.primary_color }} />
                  <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedBrand.secondary_color }} />
                  <span>{selectedBrand.primary_color} / {selectedBrand.secondary_color}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base font-display">Reference Image</CardTitle></CardHeader>
            <CardContent>
              {referencePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-border">
                  <img src={referencePreview} alt="Reference" className="w-full aspect-video object-cover" />
                  <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => { setReferenceFile(null); setReferencePreview(""); }} disabled={studioState === "generating"}>Change</Button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors" onDragOver={(e) => e.preventDefault()} onDrop={handleFileDrop}>
                  <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">Drop your reference image here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse — PNG, JPG, WebP</p>
                  <input type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </label>
              )}
            </CardContent>
          </Card>

          <Button className="w-full h-12 text-base gradient-primary hover:gradient-primary-hover text-primary-foreground font-semibold" onClick={handleGenerate} disabled={studioState === "generating" || !selectedBrandId || !referenceFile}>
            {studioState === "generating" ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Generating...</> : <><Sparkles className="h-5 w-5 mr-2" /> Generate Creative</>}
          </Button>
        </div>

        <div>
          <Card className="min-h-[400px] flex flex-col">
            <CardHeader><CardTitle className="text-base font-display">Output</CardTitle></CardHeader>
            <CardContent className="flex-1 flex items-center justify-center">
              {studioState === "idle" && (
                <div className="text-center text-muted-foreground py-16">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">Select a brand and upload a reference to begin.</p>
                </div>
              )}
              {studioState === "generating" && (
                <div className="w-full space-y-6 py-8">
                  <div className="relative w-full aspect-video rounded-lg bg-muted overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-shimmer" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-4" />
                        <p className="text-sm font-medium text-foreground animate-pulse-glow">{STEP_LABELS[currentStep]}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground text-right">{progress}%</p>
                  </div>
                </div>
              )}
              {studioState === "complete" && outputUrl && (
                <div className="w-full space-y-4">
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={outputUrl} alt="Generated creative" className="w-full aspect-video object-cover" />
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => window.open(outputUrl, "_blank")} className="flex-1"><Download className="h-4 w-4 mr-2" /> Download</Button>
                    <Button variant="outline" onClick={handleReset} className="flex-1"><RotateCcw className="h-4 w-4 mr-2" /> New Generation</Button>
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
