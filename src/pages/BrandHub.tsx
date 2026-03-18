import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Copy, FolderOpen, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

export default function BrandHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [assignGroupOpen, setAssignGroupOpen] = useState<string | null>(null);

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
      const { data, error } = await supabase.from("campaigns").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from("brands").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete brand.");
    } else {
      toast.success(`"${name}" has been deleted.`);
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !user) return;
    setCreatingGroup(true);
    const { error } = await supabase.from("campaigns").insert({ name: newGroupName.trim(), user_id: user.id });
    setCreatingGroup(false);
    if (error) {
      toast.error("Failed to create group.");
    } else {
      toast.success(`Group "${newGroupName.trim()}" created.`);
      setNewGroupName("");
      setGroupDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    }
  };

  const handleDuplicate = async (brandId: string) => {
    if (!user) return;
    setDuplicating(brandId);

    const brand = brands.find((b) => b.id === brandId);
    if (!brand) { setDuplicating(null); return; }

    const { data: newBrand, error } = await supabase
      .from("brands")
      .insert({
        name: `${brand.name} (Copy)`,
        primary_color: brand.primary_color,
        secondary_color: brand.secondary_color,
        extra_colors: brand.extra_colors,
        brand_brief: brand.brand_brief,
        brand_voice_rules: brand.brand_voice_rules,
        negative_prompts: brand.negative_prompts,
        logo_url: brand.logo_url,
        user_id: user.id,
        campaign_id: (brand as any).campaign_id || null,
      } as any)
      .select()
      .single();

    if (error || !newBrand) {
      toast.error("Failed to duplicate brand.");
      setDuplicating(null);
      return;
    }

    const { data: assets } = await supabase
      .from("brand_assets")
      .select("image_url, label")
      .eq("brand_id", brandId);

    if (assets && assets.length > 0) {
      await supabase.from("brand_assets").insert(
        assets.map((a) => ({ brand_id: newBrand.id, user_id: user.id, image_url: a.image_url, label: a.label }))
      );
    }

    setDuplicating(null);
    toast.success(`"${brand.name}" duplicated.`);
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  };

  const handleAssignGroup = async (brandId: string, groupId: string | null) => {
    const { error } = await supabase
      .from("brands")
      .update({ campaign_id: groupId } as any)
      .eq("id", brandId);
    if (error) {
      toast.error("Failed to assign group.");
    } else {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    }
    setAssignGroupOpen(null);
  };

  const groupMap = new Map<string | null, typeof brands>();
  for (const brand of brands) {
    const gid = (brand as any).campaign_id || null;
    if (!groupMap.has(gid)) groupMap.set(gid, []);
    groupMap.get(gid)!.push(brand);
  }

  const ungroupedBrands = groupMap.get(null) || [];
  const groupedEntries = groups
    .filter((g) => groupMap.has(g.id))
    .map((g) => ({ group: g, brands: groupMap.get(g.id)! }));

  const BrandCard = ({ brand }: { brand: typeof brands[0] }) => (
    <Card className="glass-card overflow-hidden hover-lift group">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {brand.logo_url ? (
            <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted/50 shrink-0 ring-1 ring-border/30">
              <img src={brand.logo_url} alt={brand.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded-xl bg-accent shrink-0 flex items-center justify-center text-accent-foreground text-lg font-bold">
              {brand.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-semibold text-foreground truncate">{brand.name}</h3>
            <div className="flex items-center gap-2 mt-2">
              <div className="h-5 w-5 rounded-full ring-1 ring-border/30" style={{ backgroundColor: brand.primary_color }} />
              <div className="h-5 w-5 rounded-full ring-1 ring-border/30" style={{ backgroundColor: brand.secondary_color }} />
              <span className="text-[11px] text-muted-foreground font-medium ml-1">{brand.primary_color} / {brand.secondary_color}</span>
            </div>
          </div>
        </div>

        {brand.brand_voice_rules && (
          <p className="text-xs text-muted-foreground mt-4 line-clamp-2">{brand.brand_voice_rules}</p>
        )}

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/30">
          <Button variant="outline" size="sm" className="flex-1 rounded-lg" onClick={() => navigate(`/brands/${brand.id}/edit`)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDuplicate(brand.id)} disabled={duplicating === brand.id} title="Duplicate" className="rounded-lg">
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setAssignGroupOpen(brand.id)} title="Move to group" className="rounded-lg">
            <FolderOpen className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => handleDelete(brand.id, brand.name)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">Brand Hub</h1>
          <p className="text-muted-foreground mt-1">Manage your brand profiles and visual identities.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGroupDialogOpen(true)} className="rounded-xl">
            <FolderOpen className="h-4 w-4 mr-2" /> New Group
          </Button>
          <Button onClick={() => navigate("/brands/new")} className="gradient-primary hover:gradient-primary-hover text-primary-foreground rounded-xl font-semibold glow-sm">
            <Plus className="h-4 w-4 mr-2" /> Add Brand
          </Button>
        </div>
      </div>

      {brands.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="p-16 text-center text-muted-foreground">
            <p className="font-medium">No brands yet.</p>
            <p className="text-sm mt-1">Add your first brand profile to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedEntries.map(({ group, brands: groupBrands }) => (
            <Collapsible key={group.id} defaultOpen>
              <div className="border border-border/40 rounded-2xl overflow-hidden glass-card">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-accent/40 transition-colors text-left">
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-display font-semibold text-foreground">{group.name}</span>
                    <Badge variant="secondary" className="text-[10px] rounded-lg">{groupBrands.length}</Badge>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto transition-transform" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-5 pt-2">
                    {groupBrands.map((brand) => (
                      <BrandCard key={brand.id} brand={brand} />
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          ))}

          {ungroupedBrands.length > 0 && (
            <div>
              {groupedEntries.length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Ungrouped</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {ungroupedBrands.map((brand) => (
                  <BrandCard key={brand.id} brand={brand} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Group Dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="groupName">Group Name</Label>
            <Input
              id="groupName"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="e.g., Summer Campaign 2026"
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              className="rounded-xl"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreateGroup} disabled={!newGroupName.trim() || creatingGroup} className="rounded-xl">
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Group Dialog */}
      <Dialog open={!!assignGroupOpen} onOpenChange={(open) => !open && setAssignGroupOpen(null)}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Move to Group</DialogTitle>
          </DialogHeader>
          <Select
            value={(brands.find((b) => b.id === assignGroupOpen) as any)?.campaign_id || "none"}
            onValueChange={(val) => handleAssignGroup(assignGroupOpen!, val === "none" ? null : val)}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select group..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No group (ungrouped)</SelectItem>
              {groups.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DialogContent>
      </Dialog>
    </div>
  );
}
