import React, { useState } from "react";
import { usePWAInstall } from "../hooks/usePWAInstall";
import {
  Download,
  Share,
  PlusSquare,
  CheckCircle2,
  Sparkles,
  Smartphone,
} from "lucide-react";
import { Button, Modal, ModalBody, ModalFooter, ModalHeader } from "./ui";

interface PWAInstallButtonProps {
  className?: string;
  variant?: "header" | "compact" | "full";
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = "",
  variant = "header",
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  // If already running inside standalone app, hide install trigger
  if (isInstalled || window.daniloomDesktop) {
    return null;
  }

  const handleInstallClick = async () => {
    setIsInstalling(true);
    await install();
    setIsInstalling(false);
  };

  // Chromium / Android / Edge Desktop flow
  if (isInstallable) {
    return (
      <button
        id="pwa-install-button"
        onClick={handleInstallClick}
        disabled={isInstalling}
          aria-label="Instalar aplicativo"
          title="Instalar aplicativo"
        className={`group relative flex items-center justify-center p-1.5 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${
          variant === "header"
            ? "text-fg-muted hover:text-fg hover:bg-hover"
            : "bg-primary hover:bg-primary-hover text-on-primary"
        } ${className}`}
      >
        <Download className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
        {variant !== "header" ? (
          <span className="whitespace-nowrap">Instalar App</span>
        ) : null}
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        <button
          id="pwa-install-ios-button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Instalar no iPhone ou iPad"
          title="Instalar no iPhone ou iPad"
          className={`flex items-center justify-center p-1.5 rounded-xl text-xs font-medium text-fg-muted hover:text-fg hover:bg-hover transition-all cursor-pointer ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5" />
        </button>

        <Modal
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          size="sm"
        >
          <ModalHeader
            title="Instalar daniloom"
            icon={<Sparkles className="w-4 h-4 text-warning-fg" />}
          />
          <ModalBody>
            <p className="text-xs text-fg-muted -mt-2">
              Instalação no Safari para iPhone/iPad
            </p>
            <div className="space-y-3.5 text-xs text-fg-secondary bg-app p-4 rounded-xl border border-line">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-muted text-fg-muted shrink-0">
                  <Share className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-fg-default block">
                    1. Toque em Compartilhar
                  </strong>
                  <span>No menu inferior ou superior do navegador Safari</span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-muted text-fg-muted shrink-0">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-fg-default block">
                    2. Adicionar à Tela de Início
                  </strong>
                  <span>
                    Role para baixo e toque em "Adicionar à Tela de Início"
                  </span>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-muted text-fg-muted shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-fg-default block">3. Pronto</strong>
                  <span>O app abre em tela cheia</span>
                </div>
              </div>
            </div>
            <ModalFooter>
              <Button className="w-full" onClick={() => setShowIOSGuide(false)}>
                Entendi
              </Button>
            </ModalFooter>
          </ModalBody>
        </Modal>
      </>
    );
  }

  return null;
};
