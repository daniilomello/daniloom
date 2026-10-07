import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

const variants = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  ghost: "text-fg-muted hover:bg-hover hover:text-fg",
  secondary: "bg-muted text-fg hover:bg-hover",
  subtle: "bg-muted text-fg hover:bg-hover",
  destructive: "bg-red-600 text-on-inverse hover:bg-red-700",
  link: "text-fg-muted hover:text-fg p-0 h-auto",
  danger: "text-danger-fg hover:text-red-600 p-0 h-auto",
} as const;

const sizes = {
  md: "px-4 py-1.5 rounded-lg",
  sm: "px-2.5 py-1 rounded-lg",
  lg: "px-4 py-2 rounded-xl",
  toolbar: "px-3 py-1.5 rounded-xl font-semibold shadow-xs",
  bare: "",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = variant === "link" || variant === "danger" ? "bare" : "md",
      type = "button",
      disabled,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer transition-colors duration-100 disabled:opacity-40 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);
