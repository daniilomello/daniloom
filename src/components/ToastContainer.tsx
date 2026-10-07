import React, { useState, useEffect } from "react";
import { subscribeToToasts, ToastItem } from "../utils/toast";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "../lib/cn";
import { IconButton } from "./ui";

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToToasts((newToast) => {
      setToasts((prev) => [...prev.slice(-4), newToast]);

      if (newToast.duration) {
        setTimeout(() => {
          removeToast(newToast.id);
        }, newToast.duration);
      }
    });

    return unsubscribe;
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const tone =
          toast.type === "success"
            ? "border-line-strong/40"
            : toast.type === "warning"
              ? "border-line"
              : toast.type === "error"
                ? "border-red-500/40"
                : "border-line";
        const icon =
          toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-success-fg shrink-0" />
          ) : toast.type === "warning" ? (
            <AlertTriangle className="w-4 h-4 text-warning-fg shrink-0" />
          ) : toast.type === "error" ? (
            <XCircle className="w-4 h-4 text-danger-fg shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-fg-muted shrink-0" />
          );

        return (
          <div
            key={toast.id}
            className={cn(
              "p-3.5 rounded-2xl border bg-overlay text-fg-default shadow-2xl pointer-events-auto flex items-center justify-between gap-3 animate-slide-down",
              tone,
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              <p className="text-xs font-medium leading-snug break-words">
                {toast.message}
              </p>
            </div>
            <IconButton title="Fechar" onClick={() => removeToast(toast.id)}>
              <X className="w-3.5 h-3.5" />
            </IconButton>
          </div>
        );
      })}
    </div>
  );
};
