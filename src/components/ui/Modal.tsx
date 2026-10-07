import { ComponentPropsWithoutRef, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/cn";
import { IconButton } from "./IconButton";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  editor: "max-w-[580px]",
} as const;

export type ModalSize = keyof typeof sizes;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: ModalSize;
  align?: "center" | "top";
  srTitle?: string;
  className?: string;
  children?: ReactNode;
  onEscapeKeyDown?: ComponentPropsWithoutRef<
    typeof Dialog.Content
  >["onEscapeKeyDown"];
  onKeyDown?: ComponentPropsWithoutRef<typeof Dialog.Content>["onKeyDown"];
}

export function Modal({
  open,
  onClose,
  size = "md",
  align = "center",
  srTitle,
  className,
  children,
  onEscapeKeyDown,
  onKeyDown,
}: ModalProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-xs animate-fade-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] ds-glass rounded-2xl shadow-2xl animate-pop-in max-h-[85vh] flex flex-col outline-none overflow-hidden",
            align === "center" ? "top-1/2 -translate-y-1/2" : "top-20",
            sizes[size],
            className,
          )}
          onEscapeKeyDown={onEscapeKeyDown}
          onKeyDown={onKeyDown}
        >
          {srTitle ? (
            <Dialog.Title className="sr-only">{srTitle}</Dialog.Title>
          ) : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ModalHeader({
  title,
  icon,
  bordered = true,
  children,
}: {
  title: string;
  icon?: ReactNode;
  bordered?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-5 py-4 shrink-0",
        bordered && "border-b border-line",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <ModalTitle>{title}</ModalTitle>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {children}
        <ModalClose />
      </div>
    </div>
  );
}

export function ModalTitle({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Dialog.Title>) {
  return (
    <Dialog.Title
      className={cn(
        "text-sm font-semibold text-fg-default truncate",
        className,
      )}
      {...props}
    >
      {children}
    </Dialog.Title>
  );
}

export function ModalClose() {
  return (
    <Dialog.Close asChild>
      <IconButton title="Fechar">
        <X className="w-4 h-4" />
      </IconButton>
    </Dialog.Close>
  );
}

export function ModalBody({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("p-5 space-y-4 overflow-y-auto flex-1", className)}>
      {children}
    </div>
  );
}

export function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-5 py-4 border-t border-line shrink-0",
        className,
      )}
    >
      {children}
    </div>
  );
}
