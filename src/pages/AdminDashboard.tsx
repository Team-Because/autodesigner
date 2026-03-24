import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Users, Palette, Sparkles, TrendingUp, CreditCard } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useState, useMemo } from "react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [monthOffset, setMonthOffset] = useState(0);

  const monthStart = startOfMonth(subMonths(new Date(), monthOffset));
  const monthEnd = endOfMonth(subMonths(new Date(), monthOffset));

  const { data: profiles = [] } = useQuery({
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
      const { data } = await supabase.from("brands").select("*");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: generations = [] } = useQuery({
    queryKey: ["admin-all-generations"],
    queryFn: async () => {
      const { data } = await supabase.from("generations").select("*").order("created_at", { ascending: false });
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

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-all-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  // Computed stats
  const monthGenerations = useMemo(() => {
    return generations.filter((g) => {
      const d = new Date(g.created_at);
      return d >= monthStart && d <= monthEnd;
    });
  }, [generations, monthStart, monthEnd]);

  const completedThisMonth = monthGenerations.filter((g) => g.status === "completed").length;
  const failedThisMonth = monthGenerations.filter((g) => g.status === "failed").length;
  const totalCreditsRemaining = credits.reduce((s, c) => s + c.credits_remaining, 0);
  const totalCreditsUsed = credits.reduce((s, c) => s + c.credits_used, 0);

  // Usage by user
  const usageByUser = useMemo(() => {
    const map: Record<string, { name: string; total: number; completed: number; creditsRemaining: number; creditsUsed: number }> = {};
    for (const p of profiles) {
      const c = credits.find((cr) => cr.user_id === p.user_id);
      map[p.user_id] = {
        name: p.display_name || p.username || p.user_id.slice(0, 8),
        total: 0,
        completed: 0,
        creditsRemaining: c?.credits_remaining ?? 0,
        creditsUsed: c?.credits_used ?? 0,
      };
    }
    for (const g of monthGenerations) {
      if (!map[g.user_id]) continue;
      map[g.user_id].total++;
      if (g.status === "completed") map[g.user_id].completed++;
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [profiles, credits, monthGenerations]);

  // Usage by brand
  const usageByBrand = useMemo(() => {
    const map: Record<string, { name: string; total: number; completed: number }> = {};
    for (const b of brands) {
      map[b.id] = { name: b.name, total: 0, completed: 0 };
    }
    for (const g of monthGenerations) {
      if (!map[g.brand_id]) map[g.brand_id] = { name: "Unknown", total: 0, completed: 0 };
      map[g.brand_id].total++;
      if (g.status === "completed") map[g.brand_id].completed++;
    }
    return Object.entries(map).filter(([, v]) => v.total > 0).sort((a, b) => b[1].total - a[1].total);
  }, [brands, monthGenerations]);

  const monthOptions = Array.from({ length: 6 }, (_, i) => ({
    value: String(i),
    label: format(subMonths(new Date(), i), "MMMM yyyy"),
  }));

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform-wide overview and usage reporting.</p>
        </div>
        <Select value={String(monthOffset)} onValueChange={(v) => setMonthOffset(Number(v))}>
          <SelectTrigger className="w-[180px]">
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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Accounts", value: profiles.length, icon: Users, tint: "card-blue" },
          { label: "Total Brands", value: brands.length, icon: Palette, tint: "card-yellow" },
          { label: "Groups", value: groups.length, icon: Palette, tint: "" },
          { label: "Credits Available", value: totalCreditsRemaining, icon: CreditCard, tint: "card-green" },
          { label: "Credits Used (All)", value: totalCreditsUsed, icon: TrendingUp, tint: "card-rose" },
        ].map((s) => (
          <Card key={s.label} className={`${s.tint} border`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  <p className="text-2xl font-display font-bold mt-2">{s.value}</p>
                </div>
                <s.icon className="h-7 w-7 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Generations This Month</p>
            <p className="text-2xl font-display font-bold mt-1">{monthGenerations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Completed</p>
            <p className="text-2xl font-display font-bold mt-1 text-success">{completedThisMonth}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">Failed</p>
            <p className="text-2xl font-display font-bold mt-1 text-destructive">{failedThisMonth}</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage by User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display">Usage by Account — {format(monthStart, "MMMM yyyy")}</CardTitle>
        </CardHeader>
        <CardContent>
          {usageByUser.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounts found.</p>
          ) : (
            <div className="space-y-3">
              {usageByUser.map(([userId, u]) => (
                <div key={userId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {u.creditsRemaining} credits left · {u.creditsUsed} used total
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{u.total} generations</p>
                    <p className="text-xs text-muted-foreground">{u.completed} completed</p>
                  </div>
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
          {usageByBrand.length === 0 ? (
            <p className="text-sm text-muted-foreground">No brand usage this month.</p>
          ) : (
            <div className="space-y-3">
              {usageByBrand.map(([brandId, b]) => (
                <div key={brandId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <p className="text-sm font-medium">{b.name}</p>
                  <div className="text-right">
                    <p className="text-sm font-medium">{b.total} generations</p>
                    <p className="text-xs text-muted-foreground">{b.completed} completed</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
