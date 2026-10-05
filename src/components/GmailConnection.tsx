import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Mail, RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { waitForGmailOAuth } from "@/lib/appUserConnectorClient";
import { completeGmailConnect, disconnectGmail, getGmailStatus, startGmailConnect, syncGmail } from "@/lib/gmail.functions";
import { Button } from "@/components/ui/button";

export function GmailConnection({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const statusCall = useServerFn(getGmailStatus);
  const start = useServerFn(startGmailConnect);
  const complete = useServerFn(completeGmailConnect);
  const sync = useServerFn(syncGmail);
  const disconnect = useServerFn(disconnectGmail);
  const [busy, setBusy] = useState(false);
  const status = useQuery({ queryKey: ["gmail-status"], queryFn: () => statusCall() });

  async function connect() {
    const popup = window.open("", "nexus-gmail", "width=600,height=720");
    if (!popup) { toast.error("Allow popups, then try again."); return; }
    setBusy(true);
    try {
      const completion = waitForGmailOAuth(popup);
      const { authorizationUrl } = await start();
      popup.location.href = authorizationUrl;
      const code = await completion;
      const result = await complete({ data: { code } });
      await queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
      await queryClient.invalidateQueries({ queryKey: ["source-connections"] });
      toast.success(result.automatic ? "Gmail connected · automatic updates on" : `Gmail connected · ${result.reason ?? "use Check inbox now"}`);
    } catch (error) {
      popup.close();
      toast.error(error instanceof Error ? error.message : "Could not connect Gmail.");
    } finally { setBusy(false); }
  }

  async function checkInbox() {
    setBusy(true);
    try {
      const result = await sync();
      if (!result.ok) { toast.error(result.error); return; }
      toast.success(result.processed ? `${result.processed} new messages checked · ${result.matched} applications updated` : "Inbox is up to date");
      await Promise.all(["gmail-status", "source-connections", "applications", "application-events"].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not check Gmail."); }
    finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try {
      await disconnect();
      await queryClient.invalidateQueries({ queryKey: ["gmail-status"] });
      await queryClient.invalidateQueries({ queryKey: ["source-connections"] });
      toast.success("Gmail disconnected");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not disconnect Gmail."); }
    finally { setBusy(false); }
  }

  if (status.isLoading) return <div className="h-8 w-28 animate-pulse rounded-md bg-secondary" />;
  if (!status.data?.connected) return <div className={compact ? "" : "mt-3"}><Button size="sm" variant={compact ? "outline" : "default"} onClick={connect} disabled={busy}><Mail />{status.data?.reconnectRequired ? "Reconnect Gmail" : "Connect Gmail"}</Button>{!compact && <p className="mt-2 text-[11px] text-muted-foreground">Read-only access. Nexus never sends, deletes, or marks mail as read.</p>}</div>;
  return <div className={compact ? "flex flex-wrap items-center gap-2" : "mt-3"}>
    {!compact && <p className="mb-2 flex items-center gap-1.5 text-xs text-success"><CheckCircle2 className="size-3.5" />Connected{status.data.email ? ` · ${status.data.email}` : ""}{status.data.automatic ? " · Live updates" : ""}</p>}
    <Button size="sm" variant="outline" onClick={checkInbox} disabled={busy}><RefreshCw className={busy ? "animate-spin" : ""} />Check inbox now</Button>
    <Button size="icon" variant="ghost" onClick={remove} disabled={busy} title="Disconnect Gmail"><Unplug /></Button>
    {!compact && <p className="mt-2 text-[11px] text-muted-foreground">{status.data.lastSyncedAt ? `Last checked ${new Date(status.data.lastSyncedAt).toLocaleString()}` : status.data.automatic ? "New recruitment mail will be checked automatically" : "Ready for the first inbox check"}</p>}
  </div>;
}