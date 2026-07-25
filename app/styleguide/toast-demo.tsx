"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SEVERITY } from "@/lib/ui/severity";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        variant="outline"
        onClick={() =>
          toast.success(SEVERITY.green.label, {
            description: "Check-in complete. Nothing needs a clinician today.",
          })
        }
      >
        On track toast
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          toast.warning(SEVERITY.amber.label, {
            description: "Temperature 38.4 °C on day 3. Queued for the nurse line.",
          })
        }
      >
        Needs attention toast
      </Button>
      <Button
        variant="destructive"
        onClick={() =>
          toast.error(SEVERITY.red.label, {
            description: "Suspected PE. Escalated to the on-call surgeon.",
          })
        }
      >
        Urgent toast
      </Button>
    </div>
  );
}
