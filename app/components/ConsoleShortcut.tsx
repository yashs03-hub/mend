"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { matchesConsoleShortcut } from "@/lib/ui/console-shortcut";

/**
 * Global listener so the presenter can open hub Ops from any product
 * surface without hunting for a link. Mounted once from the root layout;
 * never renders UI of its own. Legacy `/console` redirects here too.
 */
export function ConsoleShortcut() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesConsoleShortcut(event)) {
        return;
      }
      event.preventDefault();
      if (
        window.location.pathname === "/clinician" &&
        window.location.hash === "#ops"
      ) {
        return;
      }
      router.push("/clinician#ops");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
