"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The SBAR handoff, copyable.
 *
 * It is copyable because of what actually happens next: the nurse pastes it
 * into an EMR note or a page to the on-call surgeon. A handoff that has to be
 * retyped is a handoff that gets shortened, and the value of this block is
 * that it is complete and was not written by anybody in a hurry.
 *
 * The prose is serif — this is language, and the only long-form language on
 * the screen. Everything around it is tabular sans.
 */
export function SbarCard({ sbar, patientName }: { sbar: string; patientName: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sbar);
      setCopied(true);
      toast.success("SBAR copied", {
        description: `${patientName}'s handoff is on the clipboard.`,
      });
      setTimeout(() => setCopied(false), 2400);
    } catch {
      toast.error("Could not copy", {
        description: "The browser blocked clipboard access. Select the text instead.",
      });
    }
  }

  return (
    <div className="space-y-4">
      <p className="font-serif text-lede leading-relaxed text-ink">{sbar}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? (
            <Check aria-hidden="true" className="size-4" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {copied ? "Copied" : "Copy SBAR"}
        </Button>
        <p className="numeric text-meta text-ink-tertiary">
          {sbar.split(/\s+/).length} words · deterministic fallback, no model key
          required
        </p>
      </div>
    </div>
  );
}
