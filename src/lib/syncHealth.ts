// Tells the user when Gmail or the background scheduler has gone quiet, so a broken sync is
// noticed within a day instead of looking like "no new mail".

export const STALE_AFTER_MS = 24 * 3600_000;

export type SyncHealth = {
  gmail: {
    connected: boolean;
    status: string | null;
    /** Last successful check, or null if none yet. */
    lastSuccessAt: string | null;
    /** When Gmail sync was first set up, so a sync that never succeeds is also noticed. */
    since: string | null;
    lastError: string | null;
  };
  scheduler: {
    enabled: boolean;
    lastRunAt: string | null;
    /** When the agent was switched on. */
    since: string | null;
  };
};

export type SyncWarning = { kind: "gmail" | "scheduler"; message: string };

const olderThanADay = (iso: string | null, now: number) => {
  const time = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(time) && now - time > STALE_AFTER_MS;
};

export function syncWarnings(health: SyncHealth, now = Date.now()): SyncWarning[] {
  const warnings: SyncWarning[] = [];
  const { gmail, scheduler } = health;
  if (gmail.connected) {
    if (gmail.status === "paused")
      warnings.push({
        kind: "gmail",
        message: gmail.lastError ?? "Gmail checking is paused.",
      });
    else if (olderThanADay(gmail.lastSuccessAt ?? gmail.since, now))
      warnings.push({
        kind: "gmail",
        message:
          "Gmail hasn't been checked successfully for over a day, so new replies may be missing. Press Check inbox now or reconnect Gmail on Connections.",
      });
  }
  if (scheduler.enabled && olderThanADay(scheduler.lastRunAt ?? scheduler.since, now))
    warnings.push({
      kind: "scheduler",
      message:
        "The background agent hasn't run for over a day. Check that the scheduler is running on your server (see DEPLOY.md).",
    });
  return warnings;
}
