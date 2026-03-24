import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity } from "lucide-react";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";

const ACTION_LABELS: Record<string, { label: string; color: "default" | "secondary" | "destructive" }> = {
  "brand.created": { label: "Brand Created", color: "default" },
  "brand.updated": { label: "Brand Updated", color: "secondary" },
  "brand.deleted": { label: "Brand Deleted", color: "destructive" },
  "brand.duplicated": { label: "Brand Duplicated", color: "default" },
  "brand.transferred": { label: "Brand Transferred", color: "default" },
  "group.created": { label: "Group Created", color: "default" },
  "group.renamed": { label: "Group Renamed", color: "secondary" },
  "group.deleted": { label: "Group Deleted", color: "destructive" },
  "generation.started": { label: "Generation Started", color: "secondary" },
  "generation.completed": { label: "Generation Done", color: "default" },
  "generation.failed": { label: "Generation Failed", color: "destructive" },
  "credit.assigned": { label: "Credits Added", color: "default" },
  "credit.set": { label: "Credits Set", color: "default" },
  "credit.reset": { label: "Credits Reset", color: "destructive" },
  "user.created": { label: "User Created", color: "default" },
};

export default function AdminLogs() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [actionFilter, setActionFilter] = useState("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-activity-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data as any[]) ?? [];
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

  const profileMap = useMemo(
    () => Object.fromEntries(profiles.map((p) => [p.user_id, p.display_name || p.username || p.user_id.slice(0, 8)])),
    [profiles]
  );

  const uniqueActions = useMemo(
    () => [...new Set(logs.map((l: any) => l.action))].sort(),
    [logs]
  );

  const filtered = useMemo(() => {
    if (actionFilter === "all") return logs;
    return logs.filter((l: any) => l.action === actionFilter);
  }, [logs, actionFilter]);

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6" /> Activity Logs
          </h1>
          <p className="text-muted-foreground mt-1">Platform-wide activity and audit trail.</p>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {uniqueActions.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a]?.label || a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No activity logs found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((log: any) => {
            const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "secondary" as const };
            const meta = log.metadata && typeof log.metadata === "object" ? log.metadata : {};
            const metaStr = Object.entries(meta)
              .filter(([k]) => !k.startsWith("_"))
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ");

            return (
              <Card key={log.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={actionInfo.color} className="text-[10px]">
                          {actionInfo.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by {profileMap[log.user_id] || log.user_id.slice(0, 8)}
                        </span>
                      </div>
                      {metaStr && (
                        <p className="text-xs text-muted-foreground mt-1">{metaStr}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
