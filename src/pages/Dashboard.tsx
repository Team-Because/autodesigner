import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Zap, CheckCircle, TrendingUp, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const { data: credits } = useQuery({
    queryKey: ["user-credits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("credits_remaining, credits_used")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const successRate = generations.length > 0 ? Math.round((completedCount / generations.length) * 100) : 0;

  const stats = [
    { label: "Total Brands", value: brands.length, icon: Palette, gradient: "from-purple-500/10 to-violet-500/10", iconColor: "text-primary" },
    { label: "Generations", value: generations.length, icon: Zap, gradient: "from-teal-500/10 to-cyan-500/10", iconColor: "text-secondary" },
    { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle, gradient: "from-emerald-500/10 to-green-500/10", iconColor: "text-success" },
    { label: "Credits Left", value: credits?.credits_remaining ?? "—", icon: TrendingUp, gradient: "from-amber-500/10 to-orange-500/10", iconColor: "text-warning" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto animate-fade-in">
      {/* Hero greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening with your creatives.
          </p>
        </div>
        <Button onClick={() => navigate("/studio")} className="gradient-primary hover:gradient-primary-hover text-primary-foreground rounded-xl h-11 px-6 font-semibold glow-sm">
          <Zap className="h-4 w-4 mr-2" /> New Creative
        </Button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={stat.label} className="glass-card hover-lift overflow-hidden" style={{ animationDelay: `${i * 80}ms` }}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-3xl font-display font-bold mt-2 tracking-tight">{stat.value}</p>
                </div>
                <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent generations */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-semibold tracking-tight">Recent Generations</h2>
          {generations.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => navigate("/history")} className="text-muted-foreground hover:text-foreground gap-1">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        {generations.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-16 text-center">
              <div className="h-16 w-16 rounded-2xl gradient-vibrant flex items-center justify-center mx-auto mb-4 glow-md opacity-60">
                <Zap className="h-8 w-8 text-primary-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">No generations yet.</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Head to Studio to create your first one.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {generations.slice(0, 6).map((gen, i) => {
              const brand = brands.find((b) => b.id === gen.brand_id);
              return (
                <Card key={gen.id} className="glass-card overflow-hidden hover-lift group cursor-pointer" style={{ animationDelay: `${i * 60}ms` }} onClick={() => navigate("/history")}>
                  <div className="aspect-video bg-muted/50 relative overflow-hidden">
                    {gen.output_image_url ? (
                      <img src={gen.output_image_url} alt="Generated creative" className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground/40">
                        <Zap className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{brand?.name ?? "Unknown Brand"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(gen.created_at), "MMM d, yyyy · h:mm a")}</p>
                      </div>
                      <Badge
                        variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"}
                        className="text-[10px] font-semibold"
                      >
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
