import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { CalendarIcon, ImageOff, Download, ExternalLink, Eye } from "lucide-react";
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
      const { data } = await supabase
        .from("brands")
        .select("id, name")
        .eq("user_id", user!.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: generations = [], isLoading } = useQuery({
    queryKey: ["generations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("generations")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const brandMap = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])),
    [brands]
  );

  const isStale = (g: any) => {
    if (g.status !== "processing" && g.status !== "analyzing" && g.status !== "generating") return false;
    const age = Date.now() - new Date(g.created_at).getTime();
    return age > 10 * 60 * 1000; // older than 10 minutes
  };

  const getDisplayStatus = (g: any) => {
    if (isStale(g)) return "failed";
    return g.status;
  };

  const getDisplayImage = (g: any) => {
    if (g.output_image_url && g.output_image_url !== "") return { url: g.output_image_url, isOutput: true };
    if (g.reference_image_url && g.reference_image_url !== "") return { url: g.reference_image_url, isOutput: false };
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
    const cw = typeof g.copywriting === "string" ? JSON.parse(g.copywriting) : g.copywriting;
    return cw;
  };

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
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground">
        Generation History
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Brand</label>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="w-[180px]">
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

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">From</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFrom ? format(dateFrom, "MMM d, yyyy") : "Start"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">To</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateTo ? format(dateTo, "MMM d, yyyy") : "End"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Status</label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px]">
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
          <Button variant="ghost" size="sm" onClick={() => { setBrandFilter("all"); setStatusFilter("all"); setDateFrom(undefined); setDateTo(undefined); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Grid of cards */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ImageOff className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No generations found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((g) => {
            const cw = getCopywriting(g);
            return (
              <Card
                key={g.id}
                className="overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => setSelectedGeneration(g)}
              >
                {/* Image preview */}
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {g.output_image_url ? (
                    <>
                      <img
                        src={g.output_image_url}
                        alt="Generated creative"
                        className="w-full h-full object-cover"
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
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-card opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageOff className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-xs">
                        {g.status === "processing" || g.status === "analyzing" || g.status === "generating"
                          ? "Generating…"
                          : g.status === "failed"
                          ? "Generation failed"
                          : "No image"}
                      </p>
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {brandMap[g.brand_id] ?? "Unknown brand"}
                    </span>
                    <Badge variant={statusVariant[g.status] ?? "secondary"} className="text-xs shrink-0">
                      {g.status}
                    </Badge>
                  </div>
                  {cw?.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{cw.caption}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generation Details</DialogTitle>
          </DialogHeader>
          {selectedGeneration && (() => {
            const cw = getCopywriting(selectedGeneration);
            return (
              <div className="space-y-5">
                {/* Full-size image */}
                {selectedGeneration.output_image_url ? (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img
                      src={selectedGeneration.output_image_url}
                      alt="Generated creative"
                      className="w-full rounded-lg"
                      onError={(e) => {
                        const el = e.target as HTMLImageElement;
                        el.style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="rounded-lg bg-muted flex items-center justify-center py-20">
                    <div className="text-center text-muted-foreground">
                      <ImageOff className="h-12 w-12 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No image available</p>
                    </div>
                  </div>
                )}

                {/* Meta info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Brand</p>
                    <p className="font-medium">{brandMap[selectedGeneration.brand_id] ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Status</p>
                    <Badge variant={statusVariant[selectedGeneration.status] ?? "secondary"}>{selectedGeneration.status}</Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Created</p>
                    <p>{format(new Date(selectedGeneration.created_at), "MMM d, yyyy · h:mm a")}</p>
                  </div>
                  {selectedGeneration.campaign_message && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-muted-foreground text-xs mb-0.5">Campaign Message</p>
                      <p>{selectedGeneration.campaign_message}</p>
                    </div>
                  )}
                  {selectedGeneration.target_audience && (
                    <div className="col-span-2 sm:col-span-3">
                      <p className="text-muted-foreground text-xs mb-0.5">Target Audience</p>
                      <p>{selectedGeneration.target_audience}</p>
                    </div>
                  )}
                </div>

                {/* AI Caption */}
                {cw?.caption && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">AI Caption / Copy</p>
                    <p className="text-sm bg-muted rounded-md p-3 whitespace-pre-wrap">{cw.caption}</p>
                  </div>
                )}

                {/* Action buttons */}
                {selectedGeneration.output_image_url && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleDownload(selectedGeneration.output_image_url, `creative-${selectedGeneration.id}.png`)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(selectedGeneration.output_image_url, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> Open Full Size
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
