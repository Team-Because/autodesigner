import { UserCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ActiveAccountBadgeProps {
  /** Visual variant. `compact` is for sidebar headers; `full` is for page headers. */
  variant?: "compact" | "full";
  className?: string;
}

/**
 * Small chip that always shows which account/workspace the user is currently
 * acting as. Critical when multiple accounts are vaulted and the user can
 * switch between them — they should never have to guess whose brands they're
 * looking at.
 */
export function ActiveAccountBadge({ variant = "full", className }: ActiveAccountBadgeProps) {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return null;

  const username = profile?.username || user.email?.split("@")[0] || "";
  const displayName = profile?.display_name || username;

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary",
          className,
        )}
        title={`Signed in as ${username}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span className="truncate max-w-[120px]">{username}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary",
        className,
      )}
      title={`Signed in as ${username}`}
    >
      <UserCircle className="h-3.5 w-3.5 shrink-0" />
      <span className="text-muted-foreground">Workspace:</span>
      <span className="font-semibold text-foreground truncate max-w-[180px]">{displayName}</span>
    </div>
  );
}
