import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { CalendarIcon, ImageOff, Download, ExternalLink, Eye, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
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

export default function History() {
  const { user } = useAuth();
  const [brandFilter, setBrandFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [selectedGeneration, setSelectedGeneration] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Load ALL brands (including archived) so generations from archived brands
  // still display their brand name. The filter dropdown also shows archived
  // brands — they get a small "(archived)" suffix for clarity.
  const { data: brands = [] } = useQuery({
    queryKey: ["brands-with-archived", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name, archived").order("name");
      return (data ?? []) as { id: string; name: string; archived: boolean }[];
    },
    enabled: !!user,
  });

  const { data: generations = [], isLoading } = useQuery({
    queryKey: ["generations", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("generations")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const brandMap = useMemo(
    () => Object.fromEntries(brands.map((b) => [b.id, b.name])),
    [brands]
  );

  // Only show completed generations (hide failed)
  const filtered = useMemo(() => {
    return generations.filter((g) => {
      // Hide failed and stale processing
      if (g.status === "failed") return false;
      if ((g.status === "processing" || g.status === "analyzing" || g.status === "generating") &&
        Date.now() - new Date(g.created_at).getTime() > 10 * 60 * 1000) return false;
      if (g.status !== "completed") return false;

      if (brandFilter !== "all" && g.brand_id !== brandFilter) return false;
      if (searchQuery) {
        const brandName = brandMap[g.brand_id] || "";
        if (!brandName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      }
      if (dateFrom && new Date(g.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(g.created_at) > end) return false;
      }
      return true;
    });
  }, [generations, brandFilter, dateFrom, dateTo, searchQuery, brandMap]);

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

  const getCopywriting = (g: any) => {
    if (!g.copywriting) return null;
    return typeof g.copywriting === "string" ? JSON.parse(g.copywriting) : g.copywriting;
  };

  const getAspectClass = (g: any) => {
    const ar = g.requested_aspect_ratio;
    if (ar === "1:1") return "aspect-square";
    if (ar === "9:16") return "aspect-[9/16]";
    if (ar === "4:5") return "aspect-[4/5]";
    if (ar === "16:9") return "aspect-video";
    return "aspect-[4/3]"; // fallback for old generations
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-foreground">
        Generation History
      </h1>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by brand..."
            className="pl-8 h-9 rounded-xl text-sm"
          />
        </div>

        <Select value={brandFilter} onValueChange={setBrandFilter}>
          <SelectTrigger className="w-[180px] h-9 rounded-xl">
            <SelectValue placeholder="All Brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Brands</SelectItem>
            {brands.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 rounded-xl gap-1.5", !dateFrom && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateFrom ? format(dateFrom, "MMM d") : "From"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-9 rounded-xl gap-1.5", !dateTo && "text-muted-foreground")}>
              <CalendarIcon className="h-3.5 w-3.5" />
              {dateTo ? format(dateTo, "MMM d") : "To"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>

        {(dateFrom || dateTo || brandFilter !== "all" || searchQuery) && (
          <Button variant="ghost" size="sm" className="h-9 rounded-xl" onClick={() => { setBrandFilter("all"); setDateFrom(undefined); setDateTo(undefined); setSearchQuery(""); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ImageOff className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No completed generations found.</p>
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
                {/* Output image with reference overlay */}
                <div className={`relative ${getAspectClass(g)} bg-muted overflow-hidden`}>
                  {g.output_image_url ? (
                    <>
                      <img
                        src={g.output_image_url}
                        alt="Generated creative"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors flex items-center justify-center">
                        <Eye className="h-8 w-8 text-card opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageOff className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-xs">No image</p>
                    </div>
                  )}
                  {/* Reference image thumbnail */}
                  {g.reference_image_url && g.reference_image_url !== "" && (
                    <div className="absolute bottom-2 left-2 h-12 w-12 rounded-lg border-2 border-card shadow-md overflow-hidden bg-muted">
                      <img
                        src={g.reference_image_url}
                        alt="Reference"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>

                <CardContent className="p-4 space-y-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {brandMap[g.brand_id] ?? "Unknown brand"}
                  </p>
                  {g.requested_aspect_ratio && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {g.requested_aspect_ratio}
                    </Badge>
                  )}
                  {cw?.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{cw.caption}</p>
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
                {/* Output image */}
                {selectedGeneration.output_image_url && (
                  <div className="rounded-lg overflow-hidden bg-muted">
                    <img src={selectedGeneration.output_image_url} alt="Generated creative" className="w-full rounded-lg" />
                  </div>
                )}

                {/* Reference vs Output comparison */}
                {selectedGeneration.reference_image_url && selectedGeneration.reference_image_url !== "" && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">Reference Image</p>
                    <div className="rounded-lg overflow-hidden bg-muted max-w-xs">
                      <img src={selectedGeneration.reference_image_url} alt="Reference" className="w-full rounded-lg" />
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

                {cw?.caption && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">AI Caption / Copy</p>
                    <p className="text-sm bg-muted rounded-md p-3 whitespace-pre-wrap">{cw.caption}</p>
                  </div>
                )}

                {/* QC Advisory (if present) */}
                {cw?.qc_score != null && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-muted-foreground">Quality Score</p>
                      <Badge variant={cw.qc_score >= 7 ? "default" : cw.qc_score >= 4 ? "secondary" : "destructive"} className="text-xs">
                        {cw.qc_score}/10
                      </Badge>
                    </div>
                    {cw.qc_issues && cw.qc_issues.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Issues Found</p>
                        <ul className="text-xs space-y-0.5 text-muted-foreground list-disc list-inside bg-muted rounded-md p-2.5">
                          {(cw.qc_issues as string[]).map((issue: string, i: number) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {cw.qc_strengths && cw.qc_strengths.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Strengths</p>
                        <ul className="text-xs space-y-0.5 text-muted-foreground list-disc list-inside bg-muted rounded-md p-2.5">
                          {(cw.qc_strengths as string[]).map((s: string, i: number) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {selectedGeneration.output_image_url && (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleDownload(selectedGeneration.output_image_url, `creative-${selectedGeneration.id}.png`)}
                      className="flex-1"
                    >
                      <Download className="h-4 w-4 mr-2" /> Download
                    </Button>
                    <Button variant="outline" onClick={() => window.open(selectedGeneration.output_image_url, "_blank")}>
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
