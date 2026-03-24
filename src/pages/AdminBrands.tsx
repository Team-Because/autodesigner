import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ArrowRightLeft, Search, Palette, ChevronDown, Folder } from "lucide-react";
import { toast } from "sonner";

export default function AdminBrands() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { log } = useActivityLog();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [transferBrand, setTransferBrand] = useState<any | null>(null);
  const [targetUserId, setTargetUserId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["admin-all-brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("*").order("name");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["admin-all-groups"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("*").order("name");
      return data ?? [];
    },
    enabled: !!user && isAdmin,
  });

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.user_id, p.display_name || p.username || p.user_id.slice(0, 8)])),
    [profiles]
  );

  const groupMap = useMemo(
    () => Object.fromEntries(groups.map((g) => [g.id, g.name])),
    [groups]
  );

  const uniqueUsers = useMemo(() => {
    const seen = new Set<string>();
    return profiles.reduce<{ id: string; name: string }[]>((acc, p) => {
      if (!seen.has(p.user_id)) {
        seen.add(p.user_id);
        acc.push({ id: p.user_id, name: p.display_name || p.username || p.user_id.slice(0, 8) });
      }
      return acc;
    }, []);
  }, [profiles]);

  const filtered = useMemo(() => {
    return brands.filter((b) => {
      if (userFilter !== "all" && b.user_id !== userFilter) return false;
      if (search && !b.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [brands, userFilter, search]);

  // Group filtered brands
  const groupedFiltered = useMemo(() => {
    const result: { groupName: string; groupId: string | null; brands: typeof brands }[] = [];
    for (const g of groups) {
      const gb = filtered.filter((b) => b.campaign_id === g.id);
      if (gb.length > 0) result.push({ groupName: g.name, groupId: g.id, brands: gb });
    }
    const ungrouped = filtered.filter((b) => !b.campaign_id);
    if (ungrouped.length > 0) result.push({ groupName: "Ungrouped", groupId: null, brands: ungrouped });
    return result;
  }, [filtered, groups]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: prev[key] === false ? true : false }));
  };

  const handleTransfer = async () => {
    if (!transferBrand || !targetUserId) return;
    setTransferring(true);
    try {
      const brandId = transferBrand.id;
      const originalUserId = transferBrand.user_id;

      const { error: brandErr } = await supabase.from("brands").update({ user_id: targetUserId }).eq("id", brandId);
      if (brandErr) throw brandErr;

      await supabase.from("brand_assets").update({ user_id: targetUserId }).eq("brand_id", brandId);
      await supabase.from("generations").update({ user_id: targetUserId }).eq("brand_id", brandId);

      log("brand.transferred", "brand", brandId, {
        from_user: originalUserId,
        to_user: targetUserId,
        brand_name: transferBrand.name,
      });

      toast.success(`"${transferBrand.name}" transferred to ${profileMap[targetUserId] || targetUserId.slice(0, 8)}`);
      setTransferBrand(null);
      setTargetUserId("");
      queryClient.invalidateQueries({ queryKey: ["admin-all-brands"] });
    } catch (err: any) {
      toast.error(err.message || "Transfer failed.");
    } finally {
      setTransferring(false);
    }
  };

  if (adminLoading) {
    return <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">All Brands</h1>
        <p className="text-muted-foreground mt-1">View and transfer brands across accounts.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands..." className="pl-9 rounded-xl" />
        </div>
        <Select value={userFilter} onValueChange={setUserFilter}>
          <SelectTrigger className="w-[200px] rounded-xl">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {uniqueUsers.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Brand list grouped */}
      {brandsLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi} className="space-y-3">
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      ) : groupedFiltered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">No brands found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedFiltered.map((group) => {
            const key = group.groupId || "ungrouped";
            const isOpen = expandedGroups[key] !== false;
            return (
              <Collapsible key={key} open={isOpen} onOpenChange={() => toggleGroup(key)}>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors mb-2">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{group.groupName}</span>
                    <span className="text-xs text-muted-foreground">({group.brands.length})</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-2">
                    {group.brands.map((brand) => (
                      <Card key={brand.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {brand.logo_url ? (
                                <img src={brand.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />
                              ) : (
                                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm">
                                  {brand.name[0]}
                                </div>
                              )}
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm">{brand.name}</p>
                                  <Badge variant="outline" className="text-[10px]">
                                    {profileMap[brand.user_id] || brand.user_id.slice(0, 8)}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                <div className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: brand.primary_color }} />
                                <div className="h-3.5 w-3.5 rounded-full border" style={{ backgroundColor: brand.secondary_color }} />
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5 rounded-xl"
                                onClick={() => { setTransferBrand(brand); setTargetUserId(""); }}
                              >
                                <ArrowRightLeft className="h-3.5 w-3.5" /> Transfer
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Transfer dialog */}
      <Dialog open={!!transferBrand} onOpenChange={(open) => !open && setTransferBrand(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Brand</DialogTitle>
          </DialogHeader>
          {transferBrand && (
            <div className="space-y-4 mt-2">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-sm font-medium">{transferBrand.name}</p>
                <p className="text-xs text-muted-foreground">
                  Current owner: {profileMap[transferBrand.user_id] || transferBrand.user_id.slice(0, 8)}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Transfer to:</p>
                <Select value={targetUserId} onValueChange={setTargetUserId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles
                      .filter((p) => p.user_id !== transferBrand.user_id)
                      .map((p) => (
                        <SelectItem key={p.user_id} value={p.user_id}>
                          {p.display_name || p.username || p.user_id.slice(0, 8)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                This will transfer the brand, all its assets, and generation history. Credit usage stays with the original account.
              </p>
              <Button
                onClick={handleTransfer}
                disabled={!targetUserId || transferring}
                className="w-full gradient-primary hover:gradient-primary-hover text-primary-foreground rounded-xl"
              >
                {transferring ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Transferring...</> : "Confirm Transfer"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
