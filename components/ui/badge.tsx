import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-4xl border border-transparent px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors duration-150 focus-visible:border-ink focus-visible:ring-[3px] focus-visible:ring-ink/25 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper [a]:hover:bg-ink-secondary",
        secondary: "bg-wash text-ink-secondary [a]:hover:bg-wash-strong",
        // Severity must go through SeverityChip; this exists only so shadcn
        // internals that reference it stay on the warm palette.
        destructive:
          "border-severity-red-border bg-severity-red-bg text-severity-red-fg",
        outline: "border-line-strong text-ink-secondary [a]:hover:bg-wash",
        ghost: "text-ink-secondary hover:bg-wash",
        link: "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
