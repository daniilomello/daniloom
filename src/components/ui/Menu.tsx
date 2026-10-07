import { ComponentPropsWithoutRef, ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "../../lib/cn";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({
  className,
  sideOffset = 8,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-48 p-2 rounded-xl ds-glass shadow-2xl animate-fade-in outline-none",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

export function MenuItem({
  className,
  icon,
  danger,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Item> & {
  icon?: ReactNode;
  danger?: boolean;
}) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium cursor-pointer outline-none text-fg-secondary hover:bg-hover hover:text-fg data-[highlighted]:bg-hover data-[highlighted]:text-fg",
        danger &&
          "text-danger-fg hover:bg-red-500/10 hover:text-danger-fg data-[highlighted]:bg-red-500/10 data-[highlighted]:text-danger-fg",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className="[&>svg]:w-3.5 [&>svg]:h-3.5 shrink-0">{icon}</span>
      ) : null}
      <span className="truncate">{children}</span>
    </DropdownMenu.Item>
  );
}

export function MenuLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn(
        "px-2 py-1.5 text-meta font-medium text-fg-muted truncate",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof DropdownMenu.Separator>) {
  return (
    <DropdownMenu.Separator
      className={cn("my-1 h-px bg-line", className)}
      {...props}
    />
  );
}
