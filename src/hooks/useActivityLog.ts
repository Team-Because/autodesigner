import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

type EntityType = "brand" | "group" | "campaign" | "generation" | "credit" | "user";
type Action =
  | "brand.created"
  | "brand.updated"
  | "brand.deleted"
  | "brand.archived"
  | "brand.unarchived"
  | "brand.duplicated"
  | "brand.transferred"
  | "group.created"
  | "group.renamed"
  | "group.deleted"
  | "group.transferred"
  | "generation.started"
  | "generation.completed"
  | "generation.failed"
  | "credit.assigned"
  | "credit.set"
  | "credit.reset"
  | "user.created"
  | "password.reset";

export function useActivityLog() {
  const { user } = useAuth();

  const log = useCallback(
    async (
      action: Action,
      entityType: EntityType,
      entityId?: string,
      metadata?: Record<string, unknown>
    ) => {
      if (!user) return;
      try {
        await supabase.from("activity_logs" as any).insert({
          user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId ?? null,
          metadata: metadata ?? {},
        });
      } catch {
        // Fire-and-forget — don't break UX for logging failures
      }
    },
    [user]
  );

  return { log };
}
