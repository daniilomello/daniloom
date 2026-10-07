import { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ds-glass flex items-center gap-0.5 p-1.5 rounded-2xl min-h-[52px]",
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors duration-100",
            value === opt.value
              ? "ds-active"
              : "text-fg-muted hover:text-fg hover:bg-hover",
          )}
        >
          {opt.icon ? (
            <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{opt.icon}</span>
          ) : null}
          <span className="truncate">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

export function OptionTiles<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactNode }[];
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex items-center justify-center h-11 rounded-xl cursor-pointer transition-colors duration-100 [&>svg]:w-4 [&>svg]:h-4",
              selected
                ? "ds-active"
                : "text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            {opt.icon}
          </button>
        );
      })}
    </div>
  );
}
