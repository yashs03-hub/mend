"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getLiveCall, subscribeLiveCall } from "@/lib/sim/live-call";

/**
 * Sticky banner while a live check-in is active and the clinician is away
 * from the hub live pane. Return deep-links to `/clinician?live=1`.
 *
 * Hide on `/clinician` entirely: the hub owns embedded live UI (and may focus
 * it without the query after Call now). Show on engine / patient chart.
 */

function useLiveCallActive(): boolean {
  return useSyncExternalStore(
    subscribeLiveCall,
    () => getLiveCall().active,
    () => false,
  );
}

export function LiveCallStrip() {
  const pathname = usePathname();
  const active = useLiveCallActive();

  const onHubLiveFocus = pathname === "/clinician";
  if (!active || onHubLiveFocus) return null;

  return (
    <div role="status" className="border-t border-line bg-wash-strong">
      <div className="mx-auto flex w-full max-w-[112rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2.5 md:px-8">
        <p className="text-label text-ink">
          <span className="font-medium">Live check-in</span>
          <span aria-hidden="true" className="text-ink-tertiary">
            {" "}
            ·{" "}
          </span>
          <span className="text-ink-secondary">Margaret</span>
        </p>
        <Link
          href="/clinician?live=1"
          className="inline-flex min-h-11 items-center rounded-md bg-ink px-4 text-label font-medium text-paper hover:bg-ink/90"
        >
          Return to live session
        </Link>
      </div>
    </div>
  );
}
