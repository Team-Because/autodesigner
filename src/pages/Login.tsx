import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error("Please enter username and password.");
      return;
    }

    setLoading(true);
    const email = `${username.toLowerCase().replace(/[^a-z0-9_-]/g, "")}@internal.brandtonic`;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast.error("Invalid username or password.");
      setLoading(false);
      return;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <Card className="w-full max-w-sm glass-card animate-scale-in relative">
        <CardContent className="pt-10 pb-10 px-8 space-y-8">
          <div className="flex flex-col items-center gap-3">
            <div className="h-14 w-14 rounded-2xl gradient-vibrant flex items-center justify-center glow-md">
              <Sparkles className="h-7 w-7 text-primary-foreground" />
            </div>
            <div className="text-center">
              <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
                Just Make It
              </h1>
              <p className="text-xs text-muted-foreground mt-1 font-medium tracking-widest uppercase">
                AI Creative Studio
              </p>
            </div>
          </div>

          <form onSubmit={handleSignIn} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="your-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoComplete="username"
                className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                className="h-11 rounded-xl bg-muted/50 border-border/50 focus:bg-card transition-colors"
              />
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl text-sm font-semibold gradient-primary hover:gradient-primary-hover text-primary-foreground glow-sm" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground/70 text-center font-medium">
            Accounts are created by your admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
