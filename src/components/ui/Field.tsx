import {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
} from "react";
import { Search } from "lucide-react";
import { cn } from "../../lib/cn";

const fieldBase =
  "w-full text-xs px-3 py-2 rounded-lg bg-muted text-fg placeholder:text-fg-muted outline-none focus:ring-1 focus:ring-line disabled:opacity-40";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-xs font-medium text-fg-secondary mb-1.5",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cn(fieldBase, "font-mono", className)} {...props} />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, className)} {...props} />;
}

export function SearchInput({
  className,
  wrapperClassName,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-subtle pointer-events-none" />
      <input
        className={cn(
          "w-full text-xs pl-8 pr-3 py-1.5 rounded-xl bg-muted border border-transparent text-fg-default placeholder:text-fg-subtle outline-none focus:border-line-strong",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  title,
  className,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-100 disabled:opacity-40",
          checked ? "bg-inverse" : "bg-muted",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-xs translate-y-px transition-transform duration-100",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
