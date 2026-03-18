import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, CreditCard, ArrowRightLeft, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch all users (profiles)
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch credits for all users
      const { data: credits } = await supabase
        .from("user_credits")
        .select("*");

      // Fetch generation counts
      const { data: generations } = await supabase
        .from("generations")
        .select("user_id, id");

      const genCounts: Record<string, number> = {};
      generations?.forEach((g: any) => {
        genCounts[g.user_id] = (genCounts[g.user_id] || 0) + 1;
      });

      const creditsMap: Record<string, any> = {};
      credits?.forEach((c: any) => {
        creditsMap[c.user_id] = c;
      });

      return profiles.map((p: any) => ({
        ...p,
        credits_remaining: creditsMap[p.user_id]?.credits_remaining ?? 0,
        credits_used: creditsMap[p.user_id]?.credits_used ?? 0,
        generation_count: genCounts[p.user_id] ?? 0,
      }));
    },
    enabled: !!user,
  });

  // Fetch all brands (for transfer)
  const { data: allBrands = [] } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brands")
        .select("id, name, user_id")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // --- Create User ---
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newCredits, setNewCredits] = useState("10");
  const [creating, setCreating] = useState(false);

  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newPassword) {
      toast.error("Username and password are required.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          username: newUsername.trim(),
          password: newPassword,
          initialCredits: parseInt(newCredits) || 0,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`User "${newUsername}" created successfully!`);
      setNewUsername("");
      setNewPassword("");
      setNewCredits("10");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  // --- Manage Credits ---
  const [creditUserId, setCreditUserId] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const handleAdjustCredits = async () => {
    const amount = parseInt(creditAmount);
    if (!creditUserId || isNaN(amount) || amount === 0) {
      toast.error("Select a user and enter a non-zero amount.");
      return;
    }
    setAdjusting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-manage-credits", {
        body: { userId: creditUserId, amount },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Credits updated. New balance: ${data.credits_remaining}`);
      setCreditAmount("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust credits.");
    } finally {
      setAdjusting(false);
    }
  };

  // --- Transfer Brand ---
  const [transferBrandId, setTransferBrandId] = useState("");
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [transferring, setTransferring] = useState(false);

  const handleTransferBrand = async () => {
    if (!transferBrandId || !transferTargetUserId) {
      toast.error("Select a brand and target user.");
      return;
    }
    setTransferring(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-transfer-brand", {
        body: { brandId: transferBrandId, targetUserId: transferTargetUserId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Brand transferred successfully!");
      setTransferBrandId("");
      setTransferTargetUserId("");
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer brand.");
    } finally {
      setTransferring(false);
    }
  };

  const getUserLabel = (u: any) => u.username || u.display_name || u.user_id?.slice(0, 8);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-foreground">Admin Panel</h1>
        <p className="text-muted-foreground mt-1">Manage users, credits, and brand transfers.</p>
      </div>

      <Tabs defaultValue="users" className="space-y-6">
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="credits" className="gap-2">
            <CreditCard className="h-4 w-4" /> Credits
          </TabsTrigger>
          <TabsTrigger value="transfer" className="gap-2">
            <ArrowRightLeft className="h-4 w-4" /> Transfer
          </TabsTrigger>
        </TabsList>

        {/* ─── Users Tab ─── */}
        <TabsContent value="users" className="space-y-6">
          {/* Create User Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Plus className="h-4 w-4" /> Create New User
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="e.g. real-estate"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    disabled={creating}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial Credits</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newCredits}
                    onChange={(e) => setNewCredits(e.target.value)}
                    disabled={creating}
                  />
                </div>
                <Button onClick={handleCreateUser} disabled={creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Users Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">All Users</CardTitle>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead className="text-right">Credits Left</TableHead>
                      <TableHead className="text-right">Credits Used</TableHead>
                      <TableHead className="text-right">Generations</TableHead>
                      <TableHead>Joined</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((u: any) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {getUserLabel(u)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={u.credits_remaining > 0 ? "default" : "destructive"}>
                            {u.credits_remaining}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{u.credits_used}</TableCell>
                        <TableCell className="text-right">{u.generation_count}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(u.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Credits Tab ─── */}
        <TabsContent value="credits">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Adjust Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>User</Label>
                  <Select value={creditUserId} onValueChange={setCreditUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {getUserLabel(u)} ({u.credits_remaining} credits)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount (+/-)</Label>
                  <Input
                    type="number"
                    placeholder="e.g. 50 or -10"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    disabled={adjusting}
                  />
                </div>
                <Button onClick={handleAdjustCredits} disabled={adjusting}>
                  {adjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adjust Credits"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Transfer Tab ─── */}
        <TabsContent value="transfer">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-display">Transfer Brand</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label>Brand</Label>
                  <Select value={transferBrandId} onValueChange={setTransferBrandId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allBrands.map((b: any) => {
                        const owner = users.find((u: any) => u.user_id === b.user_id);
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            {b.name} ({owner ? getUserLabel(owner) : "unknown"})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transfer To</Label>
                  <Select value={transferTargetUserId} onValueChange={setTransferTargetUserId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select user..." />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {getUserLabel(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleTransferBrand} disabled={transferring} variant="outline">
                  {transferring ? <Loader2 className="h-4 w-4 animate-spin" /> : "Transfer Brand"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
