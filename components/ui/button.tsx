import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Every size is at least 44x44: the size variants change padding and type,
// never the hit area.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-[background-color,border-color,color,box-shadow] duration-150 outline-none select-none focus-visible:border-ink focus-visible:ring-3 focus-visible:ring-ink/25 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-ink text-paper shadow-xs hover:bg-ink-secondary",
        outline:
          "border-line-strong bg-raised text-ink shadow-xs hover:bg-wash aria-expanded:bg-wash",
        secondary:
          "bg-wash text-ink hover:bg-wash-strong aria-expanded:bg-wash-strong",
        ghost: "text-ink-secondary hover:bg-wash hover:text-ink aria-expanded:bg-wash",
        destructive:
          "border-severity-red-border bg-severity-red-bg text-severity-red-fg hover:bg-[#FDE7E7] focus-visible:border-severity-red-fg focus-visible:ring-severity-red-fg/25",
        link: "text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink",
      },
      size: {
        default:
          "h-11 gap-2 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-11 gap-1.5 px-3 text-xs has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-11 gap-1.5 px-4 text-sm has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-12 gap-2.5 px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11",
        "icon-xs": "size-11 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-11",
        "icon-lg": "size-12 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
