import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, Palette, TrendingUp, CreditCard } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useState, useMemo } from "react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [monthOffset, setMonthOffset] = useState(0);

  const monthStart = startOfMonth(subMonths(new Date(), monthOffset));
  const monthEnd = endOfMonth(subMonths(new Date(), monthOffset));

  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ["admin-all-brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name, user_id");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: generations = [], isLoading: gensLoading } = useQuery({
    queryKey: ["admin-all-generations"],
    queryFn: async () => {
      const { data } = await supabase.from("generations").select("id, user_id, brand_id, status, created_at").order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: credits = [] } = useQuery({
    queryKey: ["admin-credits"],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits").select("*");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  // Only count completed generations for credits
  const completedGens = useMemo(() => generations.filter((g) => g.status === "completed"), [generations]);

  const monthGenerations = useMemo(() => {
    return completedGens.filter((g) => {
      const d = new Date(g.created_at);
      return d >= monthStart && d <= monthEnd;
    });
  }, [completedGens, monthStart, monthEnd]);

  const totalCreditsRemaining = credits.reduce((s, c) => s + c.credits_remaining, 0);
  const totalCreditsUsed = credits.reduce((s, c) => s + c.credits_used, 0);

  // Usage by user (only completed)
  const usageByUser = useMemo(() => {
    const map: Record<string, { name: string; monthCount: number; totalCount: number; creditsRemaining: number; creditsUsed: number; brandCount: number }> = {};
    for (const p of profiles) {
      const c = credits.find((cr) => cr.user_id === p.user_id);
      const bc = brands.filter((b) => b.user_id === p.user_id).length;
      map[p.user_id] = {
        name: p.display_name || p.username || p.user_id.slice(0, 8),
        monthCount: 0,
        totalCount: 0,
        creditsRemaining: c?.credits_remaining ?? 0,
        creditsUsed: c?.credits_used ?? 0,
        brandCount: bc,
      };
    }
    for (const g of monthGenerations) {
      if (map[g.user_id]) map[g.user_id].monthCount++;
    }
    for (const g of completedGens) {
      if (map[g.user_id]) map[g.user_id].totalCount++;
    }
    return Object.entries(map).sort((a, b) => b[1].creditsUsed - a[1].creditsUsed);
  }, [profiles, credits, monthGenerations, completedGens, brands]);

  // Usage by brand (only completed)
  const usageByBrand = useMemo(() => {
    const map: Record<string, { name: string; owner: string; count: number }> = {};
    for (const b of brands) {
      const ownerProfile = profiles.find((p) => p.user_id === b.user_id);
      map[b.id] = { name: b.name, owner: ownerProfile?.display_name || ownerProfile?.username || b.user_id.slice(0, 8), count: 0 };
    }
    for (const g of monthGenerations) {
      if (map[g.brand_id]) map[g.brand_id].count++;
    }
    return Object.entries(map).filter(([, v]) => v.count > 0).sort((a, b) => b[1].count - a[1].count);
  }, [brands, monthGenerations, profiles]);

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: format(subMonths(new Date(), i), "MMMM yyyy"),
  }));

  const isLoading = profilesLoading || gensLoading;

  if (adminLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform-wide analytics and usage reporting.</p>
        </div>
        <Select value={String(monthOffset)} onValueChange={(v) => setMonthOffset(Number(v))}>
          <SelectTrigger className="w-[180px] rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Global Stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="card-blue border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Accounts</p>
                  <p className="text-3xl font-display font-bold mt-2">{profiles.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
          <Card className="card-yellow border">
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
          <Card className="card-green border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credits Available</p>
                  <p className="text-3xl font-display font-bold mt-2">{totalCreditsRemaining}</p>
                </div>
                <CreditCard className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
          <Card className="card-rose border">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credits Used</p>
                  <p className="text-3xl font-display font-bold mt-2">{totalCreditsUsed}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* This month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">
            Generations — {format(monthStart, "MMMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-display font-bold">{monthGenerations.length}</p>
          <p className="text-sm text-muted-foreground mt-1">completed generations this month</p>
        </CardContent>
      </Card>

      {/* Usage by User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Usage by Account</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : usageByUser.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2 border-b border-border">
                <span className="col-span-2">Account</span>
                <span className="text-right">Brands</span>
                <span className="text-right">This Month</span>
                <span className="text-right">Credits Left</span>
                <span className="text-right">Credits Used</span>
              </div>
              {usageByUser.map(([userId, u]) => (
                <div key={userId} className="grid grid-cols-6 gap-2 items-center py-2 border-b border-border last:border-0">
                  <span className="col-span-2 text-sm font-medium truncate">{u.name}</span>
                  <span className="text-sm text-right">{u.brandCount}</span>
                  <span className="text-sm text-right">{u.monthCount}</span>
                  <span className="text-sm text-right font-medium">{u.creditsRemaining}</span>
                  <span className="text-sm text-right text-muted-foreground">{u.creditsUsed}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage by Brand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Usage by Brand — {format(monthStart, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : usageByBrand.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brand usage this month.</p>
          ) : (
            <div className="space-y-2">
              {usageByBrand.map(([brandId, b]) => (
                <div key={brandId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">{b.owner}</p>
                  </div>
                  <span className="text-sm font-medium">{b.count} generations</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
