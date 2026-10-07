import { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const variants = {
  count: "rounded-full bg-muted text-fg-muted font-mono text-meta px-2 py-0.5",
  label:
    "rounded-full bg-muted text-fg-secondary text-meta px-2 py-0.5 inline-flex items-center gap-1.5",
  success:
    "rounded-full bg-muted text-fg-muted font-mono text-meta px-2 py-0.5",
} as const;

export function Badge({
  className,
  variant = "label",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return <span className={cn(variants[variant], className)} {...props} />;
}

export function StatusDot({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block w-1.5 h-1.5 rounded-full shrink-0",
        className,
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export function Kbd({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center rounded border border-line bg-muted px-1 py-0.5 font-mono text-meta text-fg-muted",
        className,
      )}
      {...props}
    />
  );
}
