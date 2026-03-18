import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the calling user
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await callerClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Check if any admin exists
    const { data: existingAdmins } = await supabase
      .from("user_roles")
      .select("id")
      .eq("role", "admin")
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: "An admin already exists. This function can only be used once." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Make the calling user an admin
    await supabase.from("user_roles").insert({ user_id: user.id, role: "admin" });

    // Initialize credits for this user (unlimited for admin)
    const { data: existingCredits } = await supabase
      .from("user_credits")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existingCredits) {
      await supabase.from("user_credits").insert({
        user_id: user.id,
        credits_remaining: 9999,
        credits_used: 0,
      });
    } else {
      await supabase
        .from("user_credits")
        .update({ credits_remaining: 9999 })
        .eq("user_id", user.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "You are now an admin!" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("seed-admin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
