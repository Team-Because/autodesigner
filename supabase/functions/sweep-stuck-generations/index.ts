// Sweep-stuck-generations — cron-callable cleanup that marks any generation
// stuck in transient states for >15 minutes as `failed`. Prevents admin noise
// and lets History stop showing stale "processing" rows once they expire.
//
// Triggered by a pg_cron job (see migration). Idempotent — safe to call often.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STUCK_STATUSES = ["processing", "analyzing", "adapting", "generating"];
const STUCK_AFTER_MINUTES = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const cutoff = new Date(Date.now() - STUCK_AFTER_MINUTES * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("generations")
      .update({ status: "failed" })
      .in("status", STUCK_STATUSES)
      .lt("created_at", cutoff)
      .select("id");

    if (error) throw error;

    const swept = data?.length ?? 0;
    console.log(`Swept ${swept} stuck generation(s) older than ${STUCK_AFTER_MINUTES}min`);

    return new Response(
      JSON.stringify({ ok: true, swept, cutoff }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("sweep-stuck-generations error:", msg);
    return new Response(
      JSON.stringify({ ok: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
