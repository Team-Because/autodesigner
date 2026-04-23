import { LayoutDashboard, Palette, Sparkles, Clock, LogOut, Users, BarChart3, Activity, Shield, ChevronDown, UserCircle, BookOpen, Plus } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { listAccounts, markActive, removeAccount, activateVaultedAccount, type VaultedAccount } from "@/lib/accountVault";

const userItems = [
  { title: "The Magic", url: "/", icon: Sparkles },
  { title: "Brands", url: "/brands", icon: Palette },
  { title: "Setup Guide", url: "/brand-guide", icon: BookOpen },
  { title: "History", url: "/history", icon: Clock },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
];

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: BarChart3 },
  { title: "All Brands", url: "/admin/brands", icon: Palette },
  { title: "All History", url: "/admin/history", icon: Clock },
  { title: "Accounts", url: "/admin/users", icon: Users },
  { title: "Activity Logs", url: "/admin/logs", icon: Activity },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [vaulted, setVaulted] = useState<VaultedAccount[]>([]);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, username").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "";
  const currentUsername = profile?.username || user?.email?.split("@")[0] || "";

  // Refresh vault list whenever the active user changes
  useEffect(() => {
    if (user?.id) markActive(user.id);
    setVaulted(listAccounts());
  }, [user?.id]);

  /**
   * Switch to another vaulted account WITHOUT signing out the current one.
   * Uses supabase.auth.setSession to swap tokens in place.
   */
  const handleSwitchAccount = async (account: VaultedAccount) => {
    const session = await activateVaultedAccount(account);
    if (!session) {
      // Refresh token is no longer valid (revoked / user deleted / >30d idle)
      removeAccount(account.userId);
      setVaulted(listAccounts());
      toast.error(`Session for ${account.username} expired. Please sign in again.`);
      navigate(`/login?username=${encodeURIComponent(account.username)}&add=1`);
      return;
    }
    // Reset cached queries so each account sees its own data
    queryClient.clear();
    setVaulted(listAccounts());
    toast.success(`Switched to ${account.username}`);
    navigate("/");
  };

  const handleSignOut = async () => {
    const result = await signOut();
    queryClient.clear();
    setVaulted(listAccounts());
    const switchedTo = result && "switchedTo" in result ? result.switchedTo : undefined;
    if (switchedTo) {
      toast.success(`Signed out. Now using ${switchedTo}`);
      navigate("/");
    } else {
      navigate("/login");
    }
  };

  const otherAccounts = vaulted.filter((a) => a.userId !== user?.id);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-5">
        <div className="flex items-center gap-3">
          <img src="/logo-icon.png" alt="MakeMyAd" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
          {!collapsed && (
            <span className="font-display font-bold text-lg text-foreground tracking-tight">
              MakeMyAd
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {userItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      activeClassName="bg-primary/10 text-primary font-semibold"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              {!collapsed && (
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Admin
                </p>
              )}
              <SidebarMenu className="space-y-1">
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sidebar-foreground transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-primary/10 text-primary font-semibold"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-sm">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        {!collapsed && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-muted/50 transition-colors text-left">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserCircle className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
                    {isAdmin && (
                      <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                        <Shield className="h-2.5 w-2.5 mr-0.5" /> Admin
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {currentUsername}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {otherAccounts.length > 0 && (
                <>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Switch Account
                  </p>
                  {otherAccounts.map((account) => (
                    <DropdownMenuItem
                      key={account.userId}
                      onClick={() => handleSwitchAccount(account)}
                      className="gap-2"
                    >
                      <UserCircle className="h-3.5 w-3.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{account.displayName || account.username}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{account.username}</p>
                      </div>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => navigate("/login?add=1")}
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Add another account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-3.5 w-3.5" />
                {otherAccounts.length > 0 ? `Sign out ${currentUsername}` : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {collapsed && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4 shrink-0" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
