import React, { useState } from "react";
import { CropRegion } from "../types";
import { Crop, Check, RotateCcw, Maximize2 } from "lucide-react";
import {
  Button,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Switch,
  Slider,
} from "./ui";

interface CropRegionSelectorProps {
  cropRegion: CropRegion;
  onChange: (region: CropRegion) => void;
  onClose: () => void;
}

export const CropRegionSelector: React.FC<CropRegionSelectorProps> = ({
  cropRegion,
  onChange,
  onClose,
}) => {
  const [localRegion, setLocalRegion] = useState<CropRegion>(cropRegion);

  const presets = [
    { name: "Tela Inteira", x: 0, y: 0, width: 100, height: 100 },
    { name: "Centralizado 16:9", x: 10, y: 10, width: 80, height: 80 },
    { name: "Foco Retângulo 4:3", x: 15, y: 15, width: 70, height: 70 },
    { name: "Quadrado 1:1", x: 20, y: 20, width: 60, height: 60 },
  ];

  const handleApply = () => {
    onChange(localRegion);
    onClose();
  };

  const handleReset = () => {
    const full = { enabled: false, x: 0, y: 0, width: 100, height: 100 };
    setLocalRegion(full);
    onChange(full);
  };

  return (
    <Modal open onClose={onClose} size="xl">
      <ModalHeader
        title="Gravar Área Específica"
        icon={<Crop className="w-4 h-4 text-fg-muted" />}
      />
      <ModalBody>
        <div className="flex items-center justify-between bg-app/60 p-3.5 rounded-xl border border-line">
          <span className="text-xs font-medium text-fg-default">
            Ativar recorte de área
          </span>
          <Switch
            title="Ativar recorte"
            checked={localRegion.enabled}
            onChange={(enabled) =>
              setLocalRegion((prev) => ({ ...prev, enabled }))
            }
          />
        </div>

        {/* Interactive Visual Canvas Box Preview */}
        <div className="relative w-full aspect-video bg-app rounded-xl border border-line overflow-hidden flex items-center justify-center">
          {/* Simulated Screen Content Lines */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(var(--ds-fg-muted)_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Selection Box */}
          {localRegion.enabled ? (
            <div
              className="absolute border-2 border-line-strong bg-muted shadow-2xl transition-all duration-150 flex items-center justify-center"
              style={{
                left: `${localRegion.x}%`,
                top: `${localRegion.y}%`,
                width: `${localRegion.width}%`,
                height: `${localRegion.height}%`,
              }}
            >
              <div className="bg-app/80 backdrop-blur px-2 py-1 rounded text-meta font-mono text-fg-secondary border border-line">
                {Math.round(localRegion.width)}% ×{" "}
                {Math.round(localRegion.height)}%
              </div>

              {/* Corner Handles */}
              <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-inverse rounded-full border border-white" />
              <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-inverse rounded-full border border-white" />
              <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-inverse rounded-full border border-white" />
              <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-inverse rounded-full border border-white" />
            </div>
          ) : (
            <div className="text-fg-muted text-xs flex items-center gap-2">
              <Maximize2 className="w-4 h-4" />
              <span>Grave a tela inteira ou ative o recorte acima</span>
            </div>
          )}
        </div>

        {/* Presets */}
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() =>
                setLocalRegion({
                  enabled: preset.width < 100 || preset.height < 100,
                  x: preset.x,
                  y: preset.y,
                  width: preset.width,
                  height: preset.height,
                })
              }
              className="px-3 py-1.5 bg-muted/80 hover:bg-muted rounded-lg text-xs font-medium text-fg-secondary hover:text-fg transition border border-line-strong/50"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Sliders for Custom Control */}
        {localRegion.enabled && (
          <div className="grid grid-cols-2 gap-4 bg-app/40 p-3.5 rounded-xl border border-line/60 text-xs">
            <div>
              <div className="flex justify-between text-fg-muted mb-1">
                <span>Posição X: {localRegion.x}%</span>
              </div>
              <Slider
                min={0}
                max={100 - localRegion.width}
                value={localRegion.x}
                onChange={(val) =>
                  setLocalRegion((prev) => ({
                    ...prev,
                    x: val,
                  }))
                }
                aria-label="Posição X do corte"
              />
            </div>

            <div>
              <div className="flex justify-between text-fg-muted mb-1">
                <span>Posição Y: {localRegion.y}%</span>
              </div>
              <Slider
                min={0}
                max={100 - localRegion.height}
                value={localRegion.y}
                onChange={(val) =>
                  setLocalRegion((prev) => ({
                    ...prev,
                    y: val,
                  }))
                }
                aria-label="Posição Y do corte"
              />
            </div>

            <div>
              <div className="flex justify-between text-fg-muted mb-1">
                <span>Largura: {localRegion.width}%</span>
              </div>
              <Slider
                min={20}
                max={100 - localRegion.x}
                value={localRegion.width}
                onChange={(val) =>
                  setLocalRegion((prev) => ({
                    ...prev,
                    width: val,
                  }))
                }
                aria-label="Largura do corte"
              />
            </div>

            <div>
              <div className="flex justify-between text-fg-muted mb-1">
                <span>Altura: {localRegion.height}%</span>
              </div>
              <Slider
                min={20}
                max={100 - localRegion.y}
                value={localRegion.height}
                onChange={(val) =>
                  setLocalRegion((prev) => ({
                    ...prev,
                    height: val,
                  }))
                }
                aria-label="Altura do corte"
              />
            </div>
          </div>
        )}

        <ModalFooter className="justify-between">
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" />
            Redefinir
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleApply}>
              <Check className="w-3.5 h-3.5" />
              Confirmar
            </Button>
          </div>
        </ModalFooter>
      </ModalBody>
    </Modal>
  );
};
