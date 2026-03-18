import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function BrandHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: campaignCounts = {} } = useQuery({
    queryKey: ["campaign-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaigns").select("brand_id, id").eq("status", "active");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((c: any) => {
        counts[c.brand_id] = (counts[c.brand_id] || 0) + 1;
      });
      return counts;
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

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Brand Hub</h1>
          <p className="text-muted-foreground mt-1">Manage your brand profiles and visual identities.</p>
        </div>
        <Button onClick={() => navigate("/brands/new")} className="gradient-primary hover:gradient-primary-hover text-primary-foreground">
          <Plus className="h-4 w-4 mr-2" /> Add Brand
        </Button>
      </div>

      {brands.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No brands yet. Add your first brand profile to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {brands.map((brand) => (
            <Card key={brand.id} className="overflow-hidden hover:shadow-lg transition-all group">
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
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-foreground truncate">{brand.name}</h3>
                      {campaignCounts[brand.id] > 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">{campaignCounts[brand.id]} campaign{campaignCounts[brand.id] > 1 ? "s" : ""}</Badge>
                      )}
                    </div>
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
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(brand.id, brand.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
