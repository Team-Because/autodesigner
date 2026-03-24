import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Palette, Sparkles, CheckCircle, CreditCard, Plus, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: generations = [], isLoading: gensLoading } = useQuery({
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

  const { data: credits } = useQuery({
    queryKey: ["my-credits"],
    queryFn: async () => {
      const { data } = await supabase.from("user_credits").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const successRate = generations.length > 0 ? Math.round((completedCount / generations.length) * 100) : 0;
  const isLoading = brandsLoading || gensLoading;

  const stats = [
    { label: "Total Brands", value: brands.length, icon: Palette, tint: "card-blue" },
    { label: "Generations", value: generations.length, icon: Sparkles, tint: "card-yellow" },
    { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle, tint: "card-green" },
    { label: "Credits Left", value: credits?.credits_remaining ?? 0, icon: CreditCard, tint: "card-blue" },
  ];

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "there";

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">
            Welcome back, {displayName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Here's your creative generation overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl gap-1.5" onClick={() => navigate("/brands/new")}>
            <Plus className="h-3.5 w-3.5" /> New Brand
          </Button>
          <Button size="sm" className="rounded-xl gap-1.5 gradient-primary hover:gradient-primary-hover text-primary-foreground" onClick={() => navigate("/studio")}>
            <Sparkles className="h-3.5 w-3.5" /> Generate
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border">
                <CardContent className="p-5">
                  <Skeleton className="h-4 w-20 mb-3" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : stats.map((stat) => (
              <Card key={stat.label} className={`${stat.tint} hover:shadow-md transition-all border`}>
                <CardContent className="p-5">
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold">Recent Generations</h2>
          {generations.length > 0 && (
            <Link to="/history" className="text-xs text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        {generations.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center text-muted-foreground">
              <p>No generations yet.</p>
              <Button variant="link" className="mt-2" onClick={() => navigate("/studio")}>
                Head to The Studio →
              </Button>
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
