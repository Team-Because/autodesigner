import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditCard, TrendingUp, Palette, Sparkles, Download, Chrome, MonitorDown, Puzzle, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useMemo, useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [showExtensionDialog, setShowExtensionDialog] = useState(false);

  const downloadExtension = () => {
    fetch("/brandtonic-extension.zip")
      .then(res => { if (!res.ok) throw new Error("Download failed"); return res.blob(); })
      .then(blob => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "brandtonic-extension.zip";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(err => alert(err.message));
  };

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: credits, isLoading: creditsLoading } = useQuery({
    queryKey: ["my-credits", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["brands", user?.id],
    queryFn: async () => {
      // Active brands only — archived ones are hidden from dashboard counts.
      const { data, error } = await supabase
        .from("brands")
        .select("id, name")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: generations = [], isLoading: gensLoading } = useQuery({
    queryKey: ["generations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("id, brand_id, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const completedGens = useMemo(() => generations.filter((g) => g.status === "completed"), [generations]);

  // Credits used per brand
  const usageByBrand = useMemo(() => {
    const map: Record<string, { name: string; count: number }> = {};
    for (const b of brands) {
      map[b.id] = { name: b.name, count: 0 };
    }
    for (const g of completedGens) {
      if (map[g.brand_id]) map[g.brand_id].count++;
    }
    return Object.entries(map)
      .filter(([, v]) => v.count > 0)
      .sort((a, b) => b[1].count - a[1].count);
  }, [brands, completedGens]);

  // Monthly usage (last 6 months)
  const monthlyUsage = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(new Date(), i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const count = completedGens.filter((g) => {
        const d = new Date(g.created_at);
        return d >= start && d <= end;
      }).length;
      return { label: format(monthDate, "MMM yyyy"), count };
    }).reverse();
  }, [completedGens]);

  const maxMonthly = Math.max(...monthlyUsage.map((m) => m.count), 1);
  const isLoading = creditsLoading || brandsLoading || gensLoading;
  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "there";

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Welcome back, {displayName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Your creative generation overview.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setShowExtensionDialog(true)}
        >
          <Chrome className="h-4 w-4" />
          Chrome Extension
        </Button>
      </div>

      <Dialog open={showExtensionDialog} onOpenChange={setShowExtensionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Chrome className="h-5 w-5" />
              Install BrandTonic Extension
            </DialogTitle>
            <DialogDescription>
              Generate on-brand creatives from any image on the web with a right-click.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <Button className="w-full gap-2" onClick={downloadExtension}>
              <Download className="h-4 w-4" />
              Download Extension (.zip)
            </Button>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Installation Steps:</p>
              <div className="space-y-3">
                <div className="flex gap-3 items-start">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">1</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5" /> Unzip</span>
                    Extract the downloaded ZIP file to a folder.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">2</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground flex items-center gap-1.5"><MonitorDown className="h-3.5 w-3.5" /> Open Extensions</span>
                    Go to <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">chrome://extensions</code> in Chrome.
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">3</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground flex items-center gap-1.5"><Puzzle className="h-3.5 w-3.5" /> Developer Mode</span>
                    Enable <strong>Developer mode</strong> (toggle in top-right corner).
                  </div>
                </div>
                <div className="flex gap-3 items-start">
                  <div className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">4</div>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground flex items-center gap-1.5"><Download className="h-3.5 w-3.5" /> Load Unpacked</span>
                    Click <strong>"Load unpacked"</strong> and select the unzipped folder.
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Works with Chrome, Edge, Brave, Arc, and all Chromium browsers.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card className="card-blue border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credits Left</p>
                    <p className="text-3xl font-display font-bold mt-2">{credits?.credits_remaining ?? 0}</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="card-yellow border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credits Used</p>
                    <p className="text-3xl font-display font-bold mt-2">{credits?.credits_used ?? 0}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="card-green border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Brands</p>
                    <p className="text-3xl font-display font-bold mt-2">{brands.length}</p>
                  </div>
                  <Palette className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generations</p>
                    <p className="text-3xl font-display font-bold mt-2">{completedGens.length}</p>
                  </div>
                  <Sparkles className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Monthly usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Monthly Usage</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {monthlyUsage.map((m) => (
                <div key={m.label} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-20 shrink-0">{m.label}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full rounded-full gradient-primary transition-all"
                      style={{ width: `${Math.max((m.count / maxMonthly) * 100, m.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium w-8 text-right">{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage by brand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Credits Used per Brand</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : usageByBrand.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed generations yet.</p>
          ) : (
            <div className="space-y-2">
              {usageByBrand.map(([brandId, b]) => (
                <div key={brandId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="text-sm font-medium">{b.name}</span>
                  <span className="text-sm text-muted-foreground">{b.count} credit{b.count !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
