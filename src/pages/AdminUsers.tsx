import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLog } from "@/hooks/useActivityLog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, Loader2, Shield, User, Users, CreditCard, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

export default function AdminUsers() {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const { log } = useActivityLog();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("user");

  // Credit management state
  const [creditUserId, setCreditUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditMode, setCreditMode] = useState<"add" | "set" | "reset">("add");
  const [updatingCredits, setUpdatingCredits] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // Password reset state
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Fetch all profiles (admin can see all)
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Fetch all roles
  const { data: roles = [] } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Fetch all credits
  const { data: credits = [] } = useQuery({
    queryKey: ["admin-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_credits")
        .select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const getRoleForUser = (userId: string) => {
    const r = roles.find((r) => r.user_id === userId);
    return r?.role || "user";
  };

  const getCreditsForUser = (userId: string) => {
    const c = credits.find((c) => c.user_id === userId);
    return c || { credits_remaining: 0, credits_used: 0 };
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Email and password are required.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: email.trim(), password, displayName: displayName.trim(), role },
      });

      if (error) {
        // Try to extract message from context
        let msg = "Failed to create user.";
        try {
          const ctx = (error as any).context;
          if (ctx?.json) {
            const payload = await ctx.json();
            if (payload?.error) msg = payload.error;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);

      toast.success(`Account created for ${email.trim()}`);
      setEmail("");
      setPassword("");
      setDisplayName("");
      setRole("user");
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-credits"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Users className="h-6 w-6" /> Account Management
          </h1>
          <p className="text-muted-foreground mt-1">Create and manage user accounts.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary hover:gradient-primary-hover text-primary-foreground gap-2 rounded-xl">
              <UserPlus className="h-4 w-4" /> Create Account
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">Display Name</Label>
                <Input
                  id="new-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g., Venus Team"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-email">Email</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="venus@internal.brandtonic"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full gradient-primary hover:gradient-primary-hover text-primary-foreground"
                disabled={creating}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* User list */}
      {profilesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : profiles.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No user accounts found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {profiles.map((profile) => {
            const userRole = getRoleForUser(profile.user_id);
            const userCredits = getCreditsForUser(profile.user_id);
            return (
              <Card key={profile.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {profile.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {profile.display_name || profile.username || "Unnamed User"}
                          </p>
                          <Badge
                            variant={userRole === "admin" ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {userRole === "admin" && <Shield className="h-2.5 w-2.5 mr-1" />}
                            {userRole}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          ID: {profile.user_id.slice(0, 8)}…
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-foreground">
                          {userCredits.credits_remaining} credits
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {userCredits.credits_used} used
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResetUserId(profile.user_id);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Reset Password
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreditUserId(profile.user_id);
                          setCreditAmount("");
                        }}
                      >
                        <CreditCard className="h-3.5 w-3.5" /> Credits
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Credit management dialog */}
      <Dialog open={!!creditUserId} onOpenChange={(open) => { if (!open) { setCreditUserId(null); setCreditMode("add"); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Credits</DialogTitle>
          </DialogHeader>
          {creditUserId && (() => {
            const p = profiles.find((p) => p.user_id === creditUserId);
            const c = getCreditsForUser(creditUserId);
            return (
              <div className="space-y-4 mt-2">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm font-medium">{p?.display_name || p?.username || "User"}</p>
                  <p className="text-xs text-muted-foreground">
                    Current: {c.credits_remaining} remaining · {c.credits_used} used
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Action</Label>
                  <Select value={creditMode} onValueChange={(v) => { setCreditMode(v as "add" | "set" | "reset"); setCreditAmount(""); }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add">Add Credits</SelectItem>
                      <SelectItem value="set">Set to Exact Amount</SelectItem>
                      <SelectItem value="reset">Reset to Zero</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {creditMode !== "reset" && (
                  <div className="space-y-2">
                    <Label>{creditMode === "add" ? "Credits to Add" : "Set Credits To"}</Label>
                    <Input
                      type="number"
                      min={creditMode === "add" ? "1" : "0"}
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      placeholder={creditMode === "add" ? "e.g., 50" : "e.g., 100"}
                    />
                  </div>
                )}
                {creditMode === "reset" && (
                  <p className="text-sm text-destructive">
                    This will set credits remaining to 0 and reset credits used to 0.
                  </p>
                )}
                <Button
                  className="w-full gradient-primary hover:gradient-primary-hover text-primary-foreground"
                  disabled={
                    updatingCredits ||
                    (creditMode === "add" && (!creditAmount || Number(creditAmount) <= 0)) ||
                    (creditMode === "set" && (creditAmount === "" || Number(creditAmount) < 0))
                  }
                  onClick={async () => {
                    if (creditMode === "reset") {
                      setResetConfirmOpen(true);
                      return;
                    }
                    await handleCreditUpdate();
                  }}
                >
                  {updatingCredits ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
                  ) : creditMode === "add" ? (
                    `Add ${creditAmount || "0"} Credits`
                  ) : creditMode === "set" ? (
                    `Set to ${creditAmount || "0"} Credits`
                  ) : (
                    "Reset Credits"
                  )}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Password reset dialog */}
      <Dialog open={!!resetUserId} onOpenChange={(open) => { if (!open) setResetUserId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
          </DialogHeader>
          {resetUserId && (() => {
            const p = profiles.find((p) => p.user_id === resetUserId);
            return (
              <div className="space-y-4 mt-2">
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm font-medium">{p?.display_name || p?.username || "User"}</p>
                  <p className="text-xs text-muted-foreground">ID: {resetUserId.slice(0, 8)}…</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-pw">New Password</Label>
                  <Input
                    id="reset-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    minLength={6}
                  />
                </div>
                <Button
                  className="w-full gradient-primary hover:gradient-primary-hover text-primary-foreground"
                  disabled={resettingPassword || newPassword.length < 6}
                  onClick={async () => {
                    setResettingPassword(true);
                    try {
                      const { data, error } = await supabase.functions.invoke("admin-reset-password", {
                        body: { userId: resetUserId, newPassword },
                      });
                      if (error) {
                        let msg = "Failed to reset password.";
                        try {
                          const ctx = (error as any).context;
                          if (ctx?.json) {
                            const payload = await ctx.json();
                            if (payload?.error) msg = payload.error;
                          }
                        } catch {}
                        throw new Error(msg);
                      }
                      if (data?.error) throw new Error(data.error);

                      log("password.reset", "user", resetUserId, {
                        target_user: resetUserId,
                      });
                      toast.success("Password has been reset.");
                      setResetUserId(null);
                      setNewPassword("");
                    } catch (err: any) {
                      toast.error(err.message || "Failed to reset password.");
                    } finally {
                      setResettingPassword(false);
                    }
                  }}
                >
                  {resettingPassword ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Resetting...</>
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
