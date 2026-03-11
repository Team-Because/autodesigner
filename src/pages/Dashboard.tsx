import { useBrandStore } from "@/lib/brand-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Palette, Sparkles, CheckCircle, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { brands, generations } = useBrandStore();

  const completedCount = generations.filter((g) => g.status === "completed").length;
  const successRate = generations.length > 0 ? Math.round((completedCount / generations.length) * 100) : 0;

  const stats = [
    { label: "Total Brands", value: brands.length, icon: Palette, color: "text-primary" },
    { label: "Generations", value: generations.length, icon: Sparkles, color: "text-primary" },
    { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle, color: "text-success" },
    { label: "This Month", value: completedCount, icon: TrendingUp, color: "text-primary" },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your creative generation activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-display font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color} opacity-70`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold mb-4">Recent Generations</h2>
        {generations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              No generations yet. Head to The Studio to create your first one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {generations.slice(0, 6).map((gen) => {
              const brand = brands.find((b) => b.id === gen.brand_id);
              return (
                <Card key={gen.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {gen.output_image_url ? (
                      <img
                        src={gen.output_image_url}
                        alt="Generated creative"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        No output
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{brand?.name ?? "Unknown Brand"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(gen.created_at), "MMM d, yyyy · h:mm a")}
                        </p>
                      </div>
                      <Badge
                        variant={gen.status === "completed" ? "default" : gen.status === "failed" ? "destructive" : "secondary"}
                        className="text-xs"
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
