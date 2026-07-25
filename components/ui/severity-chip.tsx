import type { Severity } from "@/lib/clinical/types";
import { severityStyle, severityToken } from "@/lib/ui/severity";
import { cn } from "@/lib/utils";

/**
 * The only sanctioned way to render a severity colour. Icon and text label are
 * not optional props: a caller cannot accidentally ship colour-only signalling.
 */
type SeverityChipSize = "sm" | "md" | "lg";

const CHIP_SIZE: Record<SeverityChipSize, string> = {
  sm: "gap-1.5 px-2.5 py-1 text-meta [&>svg]:size-3.5",
  md: "gap-2 px-3 py-1.5 text-label [&>svg]:size-4",
  lg: "gap-2.5 px-4 py-2 text-base [&>svg]:size-5",
};

export function SeverityChip({
  level,
  label,
  size = "md",
  className,
}: {
  level: Severity;
  /** Overrides the default label; falls back to the token if blank. */
  label?: string;
  size?: SeverityChipSize;
  className?: string;
}) {
  const token = severityToken(level);
  const Icon = token.icon;
  const text = label?.trim() ? label.trim() : token.label;

  return (
    <span
      data-severity={level}
      style={severityStyle(level)}
      className={cn(
        "inline-flex w-fit items-center rounded-full border font-medium whitespace-nowrap",
        CHIP_SIZE[size],
        className
      )}
    >
      <Icon aria-hidden="true" className="shrink-0" strokeWidth={2} />
      <span>{text}</span>
    </span>
  );
}

/**
 * The full-width form, for the one place on a screen where the current status
 * is the whole point: a headline in the severity colour plus its detail.
 */
export function SeverityPanel({
  level,
  headline,
  children,
  className,
}: {
  level: Severity;
  /** Overrides the default label; falls back to the token if blank. */
  headline?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const token = severityToken(level);
  const Icon = token.icon;
  const text = headline?.trim() ? headline.trim() : token.label;

  return (
    <div
      data-severity={level}
      style={severityStyle(level)}
      className={cn("flex gap-4 rounded-xl border p-5 sm:p-6", className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-7 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0 space-y-1.5">
        <p className="font-heading text-subhead">{text}</p>
        {children ? (
          <div className="text-body text-ink-secondary">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
