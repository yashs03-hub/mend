"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { matchesConsoleShortcut } from "@/lib/ui/console-shortcut";

/**
 * Global listener so the presenter can open `/console` from any product
 * surface without hunting for a link. Mounted once from the root layout;
 * never renders UI of its own.
 */
export function ConsoleShortcut() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!matchesConsoleShortcut(event)) {
        return;
      }
      event.preventDefault();
      if (window.location.pathname === "/console") {
        return;
      }
      router.push("/console");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
