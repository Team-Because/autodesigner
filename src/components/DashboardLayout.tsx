import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/brands": "Brand Hub",
  "/studio": "The Studio",
  "/history": "History",
  "/admin": "Admin Overview",
  "/admin/users": "Accounts",
  "/admin/brands": "All Brands",
  "/admin/logs": "Activity Logs",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/brands/") && pathname.endsWith("/edit")) return "Edit Brand";
  if (pathname.startsWith("/brands/")) return "New Brand";
  return "";
}

export function DashboardLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const pageTitle = getPageTitle(location.pathname);

  const { data: credits } = useQuery({
    queryKey: ["my-credits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_credits")
        .select("credits_remaining, credits_used")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
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

  const displayName = profile?.display_name || profile?.username || "";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border glass px-4 shrink-0 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="mr-1" />
              {pageTitle && (
                <h2 className="text-sm font-semibold text-foreground hidden sm:block">
                  {pageTitle}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-4">
              {credits && (
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  <span className="text-foreground font-semibold">{credits.credits_remaining}</span>
                  <span className="hidden sm:inline">credits</span>
                </div>
              )}
              {displayName && (
                <span className="text-xs text-muted-foreground hidden md:block">
                  {displayName}
                </span>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
