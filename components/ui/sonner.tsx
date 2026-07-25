"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  InfoIcon,
  Loader2Icon,
} from "lucide-react"

// Mend renders light only, so the theme is pinned rather than read from
// next-themes. Success/warning/error reuse the severity icons so a toast
// cannot disagree with a chip.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CheckCircle2 className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <AlertTriangle className="size-4" />,
        error: <AlertOctagon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-raised)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-line)",
          "--success-bg": "var(--color-severity-green-bg)",
          "--success-text": "var(--color-severity-green-fg)",
          "--success-border": "var(--color-severity-green-border)",
          "--warning-bg": "var(--color-severity-amber-bg)",
          "--warning-text": "var(--color-severity-amber-fg)",
          "--warning-border": "var(--color-severity-amber-border)",
          "--error-bg": "var(--color-severity-red-bg)",
          "--error-text": "var(--color-severity-red-fg)",
          "--error-border": "var(--color-severity-red-border)",
          "--border-radius": "var(--radius-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast font-sans text-label shadow-card",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
