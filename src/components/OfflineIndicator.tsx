import React from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { WifiOff } from "lucide-react";

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      id="pwa-offline-indicator"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 rounded-2xl bg-surface/95 border border-line px-4 py-2.5 text-xs font-semibold text-fg-secondary shadow-2xl backdrop-blur-md animate-bounce"
    >
      <div className="relative flex items-center justify-center">
        <WifiOff className="w-4 h-4 text-fg-muted" />
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fg-muted opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-fg-subtle"></span>
        </span>
      </div>
      <span>Modo Offline — Acesso a recursos em cache.</span>
    </div>
  );
};
