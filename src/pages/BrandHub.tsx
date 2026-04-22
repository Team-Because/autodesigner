import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Plus, Pencil, Trash2, FolderPlus, Folder, MoreVertical, X, Copy, Loader2, Search, ChevronDown, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useState, useMemo } from "react";
import { scoreBrandHealth } from "@/lib/brandHealth";

export default function BrandHub() {
  const { user } = useAuth();
  const { log } = useActivityLog();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newGroupName, setNewGroupName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; type: "brand" | "group" } | null>(null);

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: groups = [], isLoading: groupsLoading } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Initialize expanded state for groups
  useMemo(() => {
    if (groups.length > 0 && Object.keys(expandedGroups).length === 0) {
      const initial: Record<string, boolean> = {};
      groups.forEach((g) => { initial[g.id] = true; });
      setExpandedGroups(initial);
    }
  }, [groups]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete brand.");
    } else {
      toast.success(`"${name}" has been deleted.`);
      log("brand.deleted", "brand", id, { name });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
  };

  const handleDuplicate = async (brandId: string) => {
    if (!user) return;
    setDuplicatingId(brandId);
    try {
      const { data: original, error: fetchErr } = await supabase.from("brands").select("*").eq("id", brandId).single();
      if (fetchErr || !original) throw new Error("Failed to fetch brand");

      const { data: originalAssets = [] } = await supabase.from("brand_assets").select("*").eq("brand_id", brandId);

      const { data: newBrand, error: insertErr } = await supabase
        .from("brands")
        .insert({
          name: `${original.name} (Copy)`,
          user_id: user.id,
          logo_url: original.logo_url,
          primary_color: original.primary_color,
          secondary_color: original.secondary_color,
          extra_colors: original.extra_colors,
          brand_voice_rules: original.brand_voice_rules,
          negative_prompts: original.negative_prompts,
          brand_brief: original.brand_brief,
          campaign_id: original.campaign_id,
        })
        .select()
        .single();
      if (insertErr || !newBrand) throw new Error("Failed to duplicate brand");

      if (originalAssets && originalAssets.length > 0) {
        const assetCopies = originalAssets.map((a: any) => ({
          brand_id: newBrand.id,
          user_id: user.id,
          image_url: a.image_url,
          label: a.label,
        }));
        await supabase.from("brand_assets").insert(assetCopies);
      }

      log("brand.duplicated", "brand", newBrand.id, { source_brand_id: brandId, source_name: original.name });
      toast.success(`"${original.name}" duplicated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      navigate(`/brands/${newBrand.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate brand.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    const { data, error } = await supabase.from("campaigns").insert({ name: newGroupName.trim(), user_id: user.id }).select().single();
    if (error) {
      toast.error("Failed to create group.");
    } else {
      toast.success(`Group "${newGroupName.trim()}" created.`);
      log("group.created", "group", data?.id, { name: newGroupName.trim() });
      setNewGroupName("");
      setCreateDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    await supabase.from("brands").update({ campaign_id: null }).eq("campaign_id", groupId);
    const { error } = await supabase.from("campaigns").delete().eq("id", groupId);
    if (error) {
      toast.error("Failed to delete group.");
    } else {
      toast.success(`Group "${groupName}" deleted.`);
      log("group.deleted", "group", groupId, { name: groupName });
      queryClient.invalidateQueries({ queryKey: ["campaigns", "brands"] });
    }
  };

  const handleRenameGroup = async () => {
    if (!renameId || !renameValue.trim()) return;
    const { error } = await supabase.from("campaigns").update({ name: renameValue.trim() }).eq("id", renameId);
    if (error) {
      toast.error("Failed to rename group.");
    } else {
      toast.success("Group renamed.");
      log("group.renamed", "group", renameId, { new_name: renameValue.trim() });
      setRenameId(null);
      setRenameValue("");
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    }
  };

  const handleAssignGroup = async (brandId: string, groupId: string | null) => {
    const { error } = await supabase.from("brands").update({ campaign_id: groupId }).eq("id", brandId);
    if (error) {
      toast.error("Failed to assign group.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
  };

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, searchQuery]);

  const ungroupedBrands = filteredBrands.filter((b) => !b.campaign_id);
  const groupedBrands = groups.map((g) => ({
    ...g,
    brands: filteredBrands.filter((b) => b.campaign_id === g.id),
  }));

  const isLoading = brandsLoading || groupsLoading;

  const BrandCard = ({ brand }: { brand: typeof brands[0] }) => (
    <Card className="overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all group">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          {brand.logo_url ? (
            <div className="h-10 w-10 rounded-xl overflow-hidden bg-muted shrink-0 shadow-sm">
              <img src={brand.logo_url} alt={brand.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-10 w-10 rounded-xl bg-muted shrink-0 flex items-center justify-center text-muted-foreground text-sm font-bold">
              {brand.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-sm text-foreground truncate">{brand.name}</h3>
            <div className="flex items-center gap-1.5 mt-1.5">
              <div className="h-3.5 w-3.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: brand.primary_color }} />
              <div className="h-3.5 w-3.5 rounded-full border border-border shadow-sm" style={{ backgroundColor: brand.secondary_color }} />
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-1.5 h-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/brands/${brand.id}/edit`)} className="gap-2">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDuplicate(brand.id)} disabled={duplicatingId === brand.id} className="gap-2">
                {duplicatingId === brand.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {groups.length > 0 && (
                <>
                  {groups.map((g) => (
                    <DropdownMenuItem key={g.id} onClick={() => handleAssignGroup(brand.id, brand.campaign_id === g.id ? null : g.id)} className="gap-2">
                      <Folder className="h-3.5 w-3.5" />
                      {brand.campaign_id === g.id ? `Remove from "${g.name}"` : `Move to "${g.name}"`}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => setDeleteConfirm({ id: brand.id, name: brand.name, type: "brand" })} className="text-destructive focus:text-destructive gap-2">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="text-xs text-muted-foreground mt-3 line-clamp-2">{brand.brand_voice_rules || "No voice rules set"}</p>

        {(() => {
          const counts = assetCounts[brand.id] || { total: 0, tagged: 0 };
          const h = scoreBrandHealth({
            hasLogo: !!brand.logo_url,
            taggedAssetCount: counts.tagged,
            briefIdentity: brand.brand_brief || "",
            briefVisual: brand.brand_brief || "",
            voiceRules: brand.brand_voice_rules || "",
            visualNevers: brand.negative_prompts || "",
            contentNevers: brand.negative_prompts || "",
            industry: (brand as any).industry || null,
          });
          return (
            <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              h.color === "success" ? "border-success/40 bg-success/10 text-success" :
              h.color === "warning" ? "border-warning/40 bg-warning/10 text-warning" :
              "border-destructive/40 bg-destructive/10 text-destructive"
            }`}>
              <Sparkles className="h-2.5 w-2.5" />
              Health {h.score} · {h.label}
            </div>
          );
        })()}

        <Button variant="outline" size="sm" className="w-full mt-4 rounded-xl text-xs" onClick={() => navigate(`/brands/${brand.id}/edit`)}>
          <Pencil className="h-3 w-3 mr-1.5" /> Edit Brand
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <>
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Brands</h1>
          <p className="text-muted-foreground mt-1">Manage your brand profiles and visual identities.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search brands..."
              className="pl-8 h-9 w-48 rounded-xl text-sm"
            />
          </div>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl">
                <FolderPlus className="h-4 w-4" /> New Group
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create Brand Group</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g., Kalrav Projects"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                  className="rounded-xl"
                />
                <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()} className="rounded-xl">Create</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={() => navigate("/brands/new")} className="gradient-primary hover:gradient-primary-hover text-primary-foreground rounded-xl">
            <Plus className="h-4 w-4 mr-2" /> Add Brand
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, gi) => (
            <div key={gi} className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-8 w-full rounded-xl" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Grouped brands with collapsible sections */}
          {groupedBrands.filter((g) => g.brands.length > 0).map((group) => (
            <Collapsible
              key={group.id}
              open={expandedGroups[group.id] !== false}
              onOpenChange={() => toggleGroup(group.id)}
            >
              <div className="flex items-center gap-2 mb-3">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 hover:bg-muted/50 rounded-lg px-2 py-1 transition-colors">
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedGroups[group.id] !== false ? "" : "-rotate-90"}`} />
                    <Folder className="h-4 w-4 text-muted-foreground" />
                    {renameId === group.id ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="h-7 text-sm w-48 rounded-lg"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRenameGroup();
                            if (e.key === "Escape") setRenameId(null);
                          }}
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleRenameGroup}>Save</Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setRenameId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-sm font-semibold text-foreground">{group.name}</h2>
                        <span className="text-xs text-muted-foreground">({group.brands.length})</span>
                      </>
                    )}
                  </button>
                </CollapsibleTrigger>
                {renameId !== group.id && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => { setRenameId(group.id); setRenameValue(group.name); }}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteConfirm({ id: group.id, name: group.name, type: "group" })} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <CollapsibleContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.brands.map((brand) => (
                    <BrandCard key={brand.id} brand={brand} />
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}

          {/* Ungrouped brands */}
          {ungroupedBrands.length > 0 && (
            <div className="space-y-3">
              {groupedBrands.some((g) => g.brands.length > 0) && (
                <div className="flex items-center gap-2 px-2">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-muted-foreground">Ungrouped</h2>
                  <span className="text-xs text-muted-foreground">({ungroupedBrands.length})</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ungroupedBrands.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} />
                ))}
              </div>
            </div>
          )}

          {brands.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center text-muted-foreground">
                No brands yet. Add your first brand profile to get started.
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>

    <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {deleteConfirm?.type === "brand" ? "Brand" : "Group"}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {deleteConfirm?.type === "brand"
              ? `This will permanently delete "${deleteConfirm?.name}" and all its assets. This action cannot be undone.`
              : `This will delete the group "${deleteConfirm?.name}". Brands inside will be ungrouped but not deleted.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (deleteConfirm?.type === "brand") {
                handleDelete(deleteConfirm.id, deleteConfirm.name);
              } else if (deleteConfirm) {
                handleDeleteGroup(deleteConfirm.id, deleteConfirm.name);
              }
              setDeleteConfirm(null);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
