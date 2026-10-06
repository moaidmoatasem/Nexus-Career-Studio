import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getSyncHealth } from "@/lib/syncHealth.functions";
import { syncWarnings } from "@/lib/syncHealth";

/** Shown on Today and Connections when Gmail or the scheduler hasn't succeeded for a day. */
export function SyncBanner() {
  const call = useServerFn(getSyncHealth);
  const health = useQuery({
    queryKey: ["sync-health"],
    queryFn: () => call(),
    refetchInterval: 5 * 60_000,
  });
  const warnings = health.data ? syncWarnings(health.data) : [];
  if (!warnings.length) return null;
  return (
    <div className="mb-4 grid gap-2">
      {warnings.map((warning) => (
        <Alert key={warning.kind} variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>
            {warning.kind === "gmail" ? "Gmail needs attention" : "The agent has stopped running"}
          </AlertTitle>
          <AlertDescription>{warning.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
