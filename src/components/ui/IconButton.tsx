import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  title: string;
  variant?: "default" | "rail";
  active?: boolean;
  danger?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      className,
      title,
      variant = "default",
      active = false,
      danger = false,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        title={title}
        aria-label={title}
        className={cn(
          "inline-flex items-center justify-center cursor-pointer transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed",
          variant === "rail" ? "w-9 h-9 rounded-xl" : "p-1.5 rounded-lg",
          active ? "ds-active" : "text-fg-muted hover:text-fg hover:bg-hover",
          danger && "hover:text-danger-fg hover:bg-red-500/10",
          className,
        )}
        {...props}
      />
    );
  },
);
