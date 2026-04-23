import { useState, useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { upsertAccount } from "@/lib/accountVault";

export default function Login() {
  const { session, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // `add=1` indicates we're stacking another account on top of an existing session
  const isAddingAccount = searchParams.get("add") === "1";

  // Pre-fill username from URL param (for account switching)
  useEffect(() => {
    const username = searchParams.get("username");
    if (username) setEmail(username);
  }, [searchParams]);

  // If already signed in and we're NOT trying to add another account, bounce home
  if (!authLoading && session && !isAddingAccount) {
    return <Navigate to="/" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter your credentials.");
      return;
    }

    let loginEmail = email.trim();
    if (!loginEmail.includes("@")) {
      loginEmail = `${loginEmail}@internal.brandtonic`;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message || "Login failed. Please check your credentials.");
      return;
    }

    // Persist this session into the multi-account vault
    if (data.session) {
      const usernameGuess = email.trim().includes("@")
        ? email.trim().split("@")[0]
        : email.trim();
      // Best-effort enrichment from profiles (non-blocking)
      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("user_id", data.session.user.id)
        .maybeSingle();
      upsertAccount(data.session, {
        username: profile?.username || usernameGuess,
        displayName: profile?.display_name || undefined,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, hsl(220 80% 97%), hsl(45 96% 97%), hsl(220 72% 95%))" }}
    >
      <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, hsl(45 96% 80%), transparent 70%)" }} />
      <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, hsl(220 72% 80%), transparent 70%)" }} />

      <Card className="w-full max-w-sm glass border-border/50 shadow-xl relative z-10">
        <CardContent className="pt-10 pb-10 px-8 space-y-7">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo-icon.png" alt="MakeMyAd" className="h-11 w-11 rounded-2xl object-contain" />
            <span className="font-display font-bold text-2xl text-foreground tracking-tight">MakeMyAd</span>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            {isAddingAccount
              ? "Add another account. Your existing session stays signed in."
              : "Sign in with your account credentials."}
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Username or Email</Label>
              <Input
                id="email"
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                disabled={loading}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="h-11 rounded-xl"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold rounded-xl gradient-primary hover:gradient-primary-hover text-primary-foreground"
              disabled={loading}
            >
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : isAddingAccount ? "Add Account" : "Sign In"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center">
            Accounts are created by your admin. Contact your administrator for access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
