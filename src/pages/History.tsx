import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { CalendarIcon, ImageOff } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Copywriting } from "@/lib/types";

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

  const filtered = useMemo(() => {
    return generations.filter((g) => {
      if (brandFilter !== "all" && g.brand_id !== brandFilter) return false;
      if (statusFilter !== "all" && g.status !== statusFilter) return false;
      if (dateFrom && new Date(g.created_at) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(g.created_at) > end) return false;
      }
      return true;
    });
  }, [generations, brandFilter, statusFilter, dateFrom, dateTo]);

  const copy = (g: any): Copywriting | null => {
    if (!g.copywriting || typeof g.copywriting !== "object") return null;
    return g.copywriting as Copywriting;
  };

  return (
    <div className="space-y-6">
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

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <ImageOff className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No generations found matching your filters.</p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((g) => (
                <TableRow key={g.id} className="cursor-pointer" onClick={() => setSelectedGeneration(g)}>
                  <TableCell>
                    {g.output_image_url ? (
                      <img src={g.output_image_url} alt="" className="h-10 w-10 rounded object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                        <ImageOff className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{brandMap[g.brand_id] ?? "—"}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-muted-foreground">{g.campaign_message || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[g.status] ?? "secondary"}>{g.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{format(new Date(g.created_at), "MMM d, yyyy")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedGeneration} onOpenChange={(open) => !open && setSelectedGeneration(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generation Details</DialogTitle>
          </DialogHeader>
          {selectedGeneration && (
            <div className="space-y-4">
              {selectedGeneration.output_image_url && (
                <img src={selectedGeneration.output_image_url} alt="Generated creative" className="w-full rounded-lg" />
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Brand</p>
                  <p className="font-medium">{brandMap[selectedGeneration.brand_id] ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={statusVariant[selectedGeneration.status] ?? "secondary"}>{selectedGeneration.status}</Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Campaign</p>
                  <p>{selectedGeneration.campaign_message || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Audience</p>
                  <p>{selectedGeneration.target_audience || "—"}</p>
                </div>
              </div>
              {selectedGeneration.layout_guide && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Layout Guide</p>
                  <p className="text-sm bg-muted rounded-md p-3">{selectedGeneration.layout_guide}</p>
                </div>
              )}
              {copy(selectedGeneration) && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Copywriting</p>
                  <div className="bg-muted rounded-md p-3 space-y-1 text-sm">
                    <p><span className="font-medium">Headline:</span> {copy(selectedGeneration)!.headline}</p>
                    <p><span className="font-medium">Subline:</span> {copy(selectedGeneration)!.subline}</p>
                    <p><span className="font-medium">CTA:</span> {copy(selectedGeneration)!.cta}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
