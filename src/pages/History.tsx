import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { CalendarIcon, ImageOff, Download, ExternalLink, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";

type StatusFilter = "all" | "processing" | "completed" | "failed";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  completed: "default",
  processing: "secondary",
  failed: "destructive",
};

export default function History() {
  const { user } = useAuth();
  const [brandFilter, setBrandFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedGeneration, setSelectedGeneration] = useState<any | null>(null);

  const { data: brands = [] } = useQuery({
    queryKey: ["brands", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: generations = [], isLoading } = useQuery({
    queryKey: ["generations", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("generations").select("*").eq("user_id", user!.id).order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const brandMap = useMemo(() => Object.fromEntries(brands.map((b) => [b.id, b.name])), [brands]);

  const isStale = (g: any) => {
    if (g.status !== "processing" && g.status !== "analyzing" && g.status !== "generating") return false;
    return Date.now() - new Date(g.created_at).getTime() > 10 * 60 * 1000;
  };

  const getDisplayStatus = (g: any) => isStale(g) ? "failed" : g.status;
  const getDisplayImage = (g: any) => {
    if (g.output_image_url && g.output_image_url !== "") return { url: g.output_image_url, isOutput: true };
    return null;
  };

  const filtered = useMemo(() => {
    return generations.filter((g) => {
      if (brandFilter !== "all" && g.brand_id !== brandFilter) return false;
      const displayStatus = getDisplayStatus(g);
      if (statusFilter !== "all" && displayStatus !== statusFilter) return false;
      if (dateFrom && new Date(g.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(g.created_at) > end) return false;
      }
      return true;
    });
  }, [generations, brandFilter, statusFilter, dateFrom, dateTo]);

  const getCopywriting = (g: any) => {
    if (!g.copywriting) return null;
    return typeof g.copywriting === "string" ? JSON.parse(g.copywriting) : g.copywriting;
  };

  const getQcResult = (g: any) => getCopywriting(g)?.qc || null;

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in">
      <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
        History
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Brand</label>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px] rounded-xl bg-muted/30 border-border/50">
              <SelectValue placeholder="All Brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal rounded-xl", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal rounded-xl", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px] rounded-xl bg-muted/30 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(dateFrom || dateTo || brandFilter !== "all" || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => { setBrandFilter("all"); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); }} className="rounded-lg">
            Clear
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <ImageOff className="h-10 w-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No generations found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((g) => {
            const cw = getCopywriting(g);
            const displayStatus = getDisplayStatus(g);
            const displayImage = getDisplayImage(g);
            const qc = getQcResult(g);
            return (
              <Card
                key={g.id}
                className="glass-card overflow-hidden hover-lift cursor-pointer group"
                onClick={() => setSelectedGeneration(g)}
              >
                <div className="relative aspect-[4/3] bg-muted/30 overflow-hidden">
                  {displayImage ? (
                    <>
                      <img
                        src={displayImage.url}
                        alt="Generated creative"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                        }}
                      />
                      <div className="hidden flex-col items-center justify-center h-full text-muted-foreground">
                        <ImageOff className="h-8 w-8 mb-2 opacity-40" />
                        <p className="text-xs">Image unavailable</p>
                      </div>
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/5 transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-card opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40">
                      <ImageOff className="h-8 w-8 mb-2" />
                      <p className="text-xs">No image</p>
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground truncate">
                      {brandMap[g.brand_id] ?? "Unknown brand"}
                    </span>
                    <Badge variant={statusVariant[displayStatus] ?? "secondary"} className="text-[10px] font-semibold rounded-lg shrink-0">
                      {displayStatus === "failed" && isStale(g) ? "timed out" : displayStatus}
                    </Badge>
                  </div>
                  {cw?.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{cw.caption}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/70 font-medium">
                    {format(new Date(g.created_at), "MMM d, yyyy · h:mm a")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedGeneration} onOpenChange={(open) => !open && setSelectedGeneration(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Generation Details</DialogTitle>
          </DialogHeader>
          {selectedGeneration && (() => {
            const cw = getCopywriting(selectedGeneration);
            const dImg = getDisplayImage(selectedGeneration);
            const dStatus = getDisplayStatus(selectedGeneration);
            const dQc = getQcResult(selectedGeneration);
            return (
              <div className="space-y-5">
                {dImg ? (
                  <div className="rounded-2xl overflow-hidden bg-muted/30 relative">
                    <img src={dImg.url} alt="Generated creative" className="w-full rounded-2xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted/30 flex items-center justify-center py-20">
                    <div className="text-center text-muted-foreground">
                      <ImageOff className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-medium">No image available</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Brand</p>
                    <p className="font-semibold">{brandMap[selectedGeneration.brand_id] ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                    <Badge variant={statusVariant[dStatus] ?? "secondary"} className="rounded-lg">
                      {dStatus === "failed" && isStale(selectedGeneration) ? "Timed out" : dStatus}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                    <p>{format(new Date(selectedGeneration.created_at), "MMM d, yyyy · h:mm a")}</p>
                  </div>
                </div>

                {cw?.caption && (
                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">AI Caption</p>
                    <p className="text-sm bg-muted/30 rounded-xl p-4 whitespace-pre-wrap">{cw.caption}</p>
                  </div>
                )}

                {dQc && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quality Check</p>
                      <Badge variant={dQc.passed ? "default" : "destructive"} className="gap-1 text-xs rounded-lg">
                        {dQc.passed ? <><CheckCircle2 className="h-3 w-3" /> Pass ({dQc.score}/100)</> : <><AlertTriangle className="h-3 w-3" /> Fail ({dQc.score}/100)</>}
                      </Badge>
                    </div>
                    {dQc.issues?.length > 0 && (
                      <ul className="text-sm bg-muted/30 rounded-xl p-4 space-y-1">
                        {dQc.issues.map((issue: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                            <span className="text-muted-foreground">{issue}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {dImg && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleDownload(dImg.url, `creative-${selectedGeneration.id}.png`)}
                      className="flex-1 rounded-xl gradient-primary hover:gradient-primary-hover text-primary-foreground font-semibold"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Button variant="outline" onClick={() => window.open(dImg.url, "_blank")} className="rounded-xl">
                      <ExternalLink className="h-4 w-4 mr-2" /> Open
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
