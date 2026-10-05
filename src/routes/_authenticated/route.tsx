import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Radar, Archive, Bookmark, KanbanSquare, Send, Landmark, FileText, LogOut, ShieldCheck, SunMedium, Plug, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Shell,
});

const NAV = [
  { to: "/today", label: "Mission Control", icon: SunMedium, hint: "Agent activity and your next step" },
  { to: "/radar", label: "Discover", icon: Radar, hint: "Review new opportunities" },
  { to: "/saved", label: "Saved roles", icon: Bookmark, hint: "Review your shortlist" },
  { to: "/portal", label: "New application", icon: Send, hint: "Type job details" },
  { to: "/applications", label: "Applications", icon: KanbanSquare, Send, hint: "Prepare and track" },
  { to: "/vault", label: "Career profile", icon: Archive, hint: "Evidence and preferences" },
  { to: "/resume", label: "Resume", icon: FileText, hint: "Review and download" },
  { to: "/connections", label: "Connections", icon: Plug, hint: "Gmail and sources" },
  { to: "/sponsors", label: "Sponsor check", icon: Landmark, hint: "Check the UK register" },
  { to: "/settings", label: "Settings", icon: Settings, hint: "Export or delete your data" },
] as const;

function WorkspaceSidebar() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (router) => router.location.pathname });
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="px-4 py-5 group-data-[collapsible=icon]:px-2">
        <Link to="/today" className="flex h-10 items-center gap-3 overflow-hidden">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground"><ShieldCheck className="size-4" /></span>
          {!collapsed && <span><strong className="block font-display text-sm text-sidebar-accent-foreground">Nexus</strong><span className="block text-[10px] text-sidebar-foreground/55">CAREER STUDIO</span></span>}
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="mb-2 text-[10px] font-semibold uppercase text-sidebar-foreground/45">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={path === item.to} tooltip={item.label} className="h-11 rounded-md px-3 data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground">
                    <Link to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 pb-4">
        {!collapsed && <div className="mb-2 rounded-md border border-sidebar-border bg-sidebar-accent/45 p-3"><p className="text-xs font-medium text-sidebar-accent-foreground">Evidence protected</p><p className="mt-1 text-[11px] leading-relaxed text-sidebar-foreground/55">Tailored claims are checked against your vault.</p></div>}
        <Button variant="ghost" className="justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>
          <LogOut className="size-4" />{!collapsed && "Sign out"}
        </Button>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function Shell() {
  return (
    <SidebarProvider>
      <WorkspaceSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 items-center border-b bg-background/92 px-4 backdrop-blur md:px-6 print:hidden">
          <SidebarTrigger className="mr-3" />
          <div className="h-4 w-px bg-border" />
          <p className="ml-3 text-xs text-muted-foreground">Your next step, clearly</p>
        </header>
        <div className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-7 md:px-8 md:py-10"><Outlet /></div>
      </SidebarInset>
    </SidebarProvider>
  );
}