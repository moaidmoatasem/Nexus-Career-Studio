import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const REDIRECT = "https://connector-gateway.lovable.dev/api/v1/app-users/oauth2/callback";

export function GmailSetupHelp() {
  return <details className="mt-4 rounded-md border bg-secondary/40 p-4 text-sm">
    <summary className="cursor-pointer font-medium">Seeing "redirect_uri_mismatch" or "access blocked"? Fix it in Google Cloud</summary>
    <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
      <li>Open <a className="text-primary underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud → Credentials</a> and select your Web application sign-in client.</li>
      <li>Under <b>Authorized redirect URIs</b>, add exactly:
        <div className="mt-2 flex items-center gap-2"><code className="flex-1 break-all rounded bg-background px-2 py-1 text-xs">{REDIRECT}</code>
          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(REDIRECT); toast.success("Copied"); }}><Copy />Copy</Button></div>
      </li>
      <li>In <a className="text-primary underline" href="https://console.cloud.google.com/apis/library/gmail.googleapis.com" target="_blank" rel="noreferrer">API Library</a>, make sure <b>Gmail API</b> is enabled.</li>
      <li>On the <b>OAuth consent screen</b>, add your Gmail address under <b>Test users</b> while the app is in Testing.</li>
      <li>Save, wait about 5 minutes, then press <b>Connect Gmail</b> again.</li>
    </ol>
  </details>;
}
