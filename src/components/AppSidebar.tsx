import { LayoutDashboard, Palette, Sparkles, Clock, LogOut, Users, BarChart3, ArrowRightLeft, Activity, Shield } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useQuery } from "@tanstack/react-query";
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

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Brand Hub", url: "/brands", icon: Palette },
  { title: "The Studio", url: "/studio", icon: Sparkles },
  { title: "History", url: "/history", icon: Clock },
];

const adminItems = [
  { title: "Overview", url: "/admin", icon: BarChart3 },
  { title: "Accounts", url: "/admin/users", icon: Users },
  { title: "All Brands", url: "/admin/brands", icon: ArrowRightLeft },
  { title: "Activity Logs", url: "/admin/logs", icon: Activity },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, username").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const displayName = profile?.display_name || profile?.username || user?.email?.split("@")[0] || "";

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
              {navItems.map((item) => (
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
          <div className="mb-2 px-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-foreground truncate">{displayName}</p>
              {isAdmin && (
                <Badge variant="default" className="text-[9px] px-1.5 py-0 h-4">
                  <Shield className="h-2.5 w-2.5 mr-0.5" /> Admin
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {user.email}
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
