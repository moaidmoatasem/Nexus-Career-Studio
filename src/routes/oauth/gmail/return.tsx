import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/oauth/gmail/return")({
  head: () => ({ meta: [
    { title: "Connecting Gmail — Nexus Career Studio" },
    { name: "description", content: "Securely completing your Gmail connection." },
    { property: "og:title", content: "Connecting Gmail — Nexus Career Studio" },
    { property: "og:description", content: "Securely completing your Gmail connection." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: GmailOAuthReturn,
});

function GmailOAuthReturn() {
  const [message, setMessage] = useState("Finishing Gmail connection…");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success") === "true";
    const code = params.get("code");
    if (!success || !code) {
      setMessage("Gmail connection did not complete. You can close this window and try again.");
      window.opener?.postMessage({ type: "appUserConnectorOAuthFailed", connectorId: "google_mail" }, window.location.origin);
      return;
    }
    window.opener?.postMessage({ type: "appUserConnectorOAuthComplete", connectorId: "google_mail", code }, window.location.origin);
    window.close();
  }, []);
  return <main className="grid min-h-screen place-items-center bg-background px-6 text-center"><p className="text-sm text-muted-foreground">{message}</p></main>;
}