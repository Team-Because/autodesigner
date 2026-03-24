import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Sparkles, CheckCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const { user } = useAuth();

  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: generations = [] } = useQuery({
    queryKey: ["generations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("generations").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const successRate = generations.length > 0 ? Math.round((completedCount / generations.length) * 100) : 0;

  const stats = [
    { label: "Total Brands", value: brands.length, icon: Palette, tint: "card-blue" },
    { label: "Generations", value: generations.length, icon: Sparkles, tint: "card-yellow" },
    { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle, tint: "card-green" },
    { label: "Completed", value: completedCount, icon: TrendingUp, tint: "card-blue" },
  ];

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "there";

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">
          Welcome back, {displayName} 👋
        </h1>
        <p className="text-muted-foreground mt-1">Here's your creative generation overview.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className={`${stat.tint} hover:shadow-md transition-all border`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
                  <p className="text-3xl font-display font-bold mt-2">{stat.value}</p>
                </div>
                <stat.icon className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold mb-4">Recent Generations</h2>
        {generations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
              No generations yet. Head to The Studio to create your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {generations.slice(0, 6).map((gen) => {
              const brand = brands.find((b) => b.id === gen.brand_id);
              return (
                <Card key={gen.id} className="overflow-hidden hover:shadow-lg transition-all group">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {gen.output_image_url ? (
                      <img src={gen.output_image_url} alt="Generated creative" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">No output</div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{brand?.name ?? "Unknown Brand"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(gen.created_at), "MMM d, yyyy · h:mm a")}</p>
                      </div>
                      <Badge variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"} className="text-xs rounded-full">
                        {gen.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
