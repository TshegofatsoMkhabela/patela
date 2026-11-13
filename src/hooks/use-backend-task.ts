import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/patela-api";

/**
 * Runs a backend call with a busy flag, showing the backend's own error
 * message (or `fallback` for anything else) as a toast.
 */
export function useBackendTask(fallback: string) {
  const [busy, setBusy] = useState(false);

  function run(task: () => Promise<void>) {
    setBusy(true);
    void task()
      .catch((error) => toast.error(error instanceof ApiError ? error.message : fallback))
      .finally(() => setBusy(false));
  }

  return [busy, run] as const;
}
