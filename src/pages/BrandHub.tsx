import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Plus, Pencil, Trash2, FolderPlus, Folder, MoreVertical, FolderOpen, X, Copy, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useState } from "react";

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

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("*").order("name", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

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
      // Fetch the brand
      const { data: original, error: fetchErr } = await supabase
        .from("brands")
        .select("*")
        .eq("id", brandId)
        .single();
      if (fetchErr || !original) throw new Error("Failed to fetch brand");

      // Fetch its assets
      const { data: originalAssets = [] } = await supabase
        .from("brand_assets")
        .select("*")
        .eq("brand_id", brandId);

      // Insert duplicated brand
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

      // Copy assets
      if (originalAssets && originalAssets.length > 0) {
        const assetCopies = originalAssets.map((a: any) => ({
          brand_id: newBrand.id,
          user_id: user.id,
          image_url: a.image_url,
          label: a.label,
        }));
        await supabase.from("brand_assets").insert(assetCopies);
      }

      log("brand.duplicated", "brand", newBrand.id, {
        source_brand_id: brandId,
        source_name: original.name,
      });

      toast.success(`"${original.name}" duplicated successfully.`);
      queryClient.invalidateQueries({ queryKey: ["brands"] });

      // Navigate to edit the new brand so user can rename
      navigate(`/brands/${newBrand.id}/edit`);
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate brand.");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    const { data, error } = await supabase
      .from("campaigns")
      .insert({ name: newGroupName.trim(), user_id: user.id })
      .select()
      .single();
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

  // Organize brands by group
  const ungroupedBrands = brands.filter((b) => !b.campaign_id);
  const groupedBrands = groups.map((g) => ({
    ...g,
    brands: brands.filter((b) => b.campaign_id === g.id),
  }));

  const BrandCard = ({ brand }: { brand: typeof brands[0] }) => (
    <Card className="overflow-hidden hover:shadow-lg transition-all group">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {brand.logo_url ? (
            <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
              <img src={brand.logo_url} alt={brand.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-lg bg-muted shrink-0 flex items-center justify-center text-muted-foreground text-lg font-bold">
              {brand.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-foreground truncate">{brand.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: brand.primary_color }} />
              <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: brand.secondary_color }} />
              <span className="text-xs text-muted-foreground ml-1">{brand.primary_color} / {brand.secondary_color}</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 line-clamp-2">{brand.brand_voice_rules}</p>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/brands/${brand.id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="px-2">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => handleDuplicate(brand.id)}
                disabled={duplicatingId === brand.id}
                className="gap-2"
              >
                {duplicatingId === brand.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {groups.length > 0 && (
                <>
                  {groups.map((g) => (
                    <DropdownMenuItem
                      key={g.id}
                      onClick={() => handleAssignGroup(brand.id, brand.campaign_id === g.id ? null : g.id)}
                      className="gap-2"
                    >
                      <Folder className="h-3.5 w-3.5" />
                      {brand.campaign_id === g.id ? `Remove from "${g.name}"` : `Move to "${g.name}"`}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => handleDelete(brand.id, brand.name)}
                className="text-destructive focus:text-destructive gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Brand Hub</h1>
          <p className="text-muted-foreground mt-1">Manage your brand profiles and visual identities.</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
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
                />
                <Button onClick={handleCreateGroup} disabled={!newGroupName.trim()}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={() => navigate("/brands/new")} className="gradient-primary hover:gradient-primary-hover text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add Brand
          </Button>
        </div>
      </div>

      {/* Grouped brands */}
      {groupedBrands.filter((g) => g.brands.length > 0).map((group) => (
        <div key={group.id} className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
            {renameId === group.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="h-7 text-sm w-48"
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-1">
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setRenameId(group.id); setRenameValue(group.name); }}>
                      <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Group
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {group.brands.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        </div>
      ))}

      {/* Ungrouped brands */}
      {ungroupedBrands.length > 0 && (
        <div className="space-y-3">
          {groupedBrands.some((g) => g.brands.length > 0) && (
            <div className="flex items-center gap-2">
              <Folder className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">Ungrouped</h2>
              <span className="text-xs text-muted-foreground">({ungroupedBrands.length})</span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ungroupedBrands.map((brand) => (
              <BrandCard key={brand.id} brand={brand} />
            ))}
          </div>
        </div>
      )}

      {brands.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No brands yet. Add your first brand profile to get started.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
