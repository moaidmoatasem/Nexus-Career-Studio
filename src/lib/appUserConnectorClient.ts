export function waitForGmailOAuth(popup: Window) {
  return new Promise<string>((resolve, reject) => {
    let poll: number | undefined;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      if (poll !== undefined) window.clearInterval(poll);
    };
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== popup || event.data?.connectorId !== "google_mail") return;
      if (event.data?.type !== "appUserConnectorOAuthComplete" && event.data?.type !== "appUserConnectorOAuthFailed") return;
      cleanup();
      if (event.data.type === "appUserConnectorOAuthComplete" && typeof event.data.code === "string") resolve(event.data.code);
      else reject(new Error("Gmail connection did not complete."));
    };
    window.addEventListener("message", onMessage);
    poll = window.setInterval(() => {
      if (!popup.closed) return;
      cleanup();
      reject(new Error("The Gmail window was closed before connection finished."));
    }, 500);
  });
}