import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * The semantic type scale from app/globals.css. tailwind-merge cannot tell
 * `text-subhead` (a size) from `text-ink` (a colour) on its own, and would
 * silently drop the size when both appear in one cn() call.
 */
const FONT_SIZES = [
  "display",
  "title",
  "heading",
  "subhead",
  "lede",
  "body",
  "body-lg",
  "label",
  "meta",
  "eyebrow",
  "family-eyebrow",
  "family-label",
  "vital",
] as const

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZES] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
