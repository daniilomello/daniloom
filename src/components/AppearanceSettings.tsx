import { Moon, Sun, Grid, CircleDot, Square, Disc } from "lucide-react";
import { ThemeSettings } from "../types";
import { PALETTES, PALETTE_IDS } from "../theme/palettes";
import { Label, OptionTiles } from "./ui";
import { cn } from "../lib/cn";

export function AppearanceSettings({
  theme,
  onUpdateTheme,
}: {
  theme: ThemeSettings;
  onUpdateTheme: (updates: Partial<ThemeSettings>) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Label className="mb-2">Aparência</Label>
        <OptionTiles
          value={theme.mode}
          onChange={(mode) => onUpdateTheme({ mode })}
          options={[
            { value: "dark", label: "Escuro", icon: <Moon /> },
            { value: "light", label: "Claro", icon: <Sun /> },
          ]}
        />
      </div>
      <div className="space-y-3">
        <Label className="mb-2">Estilo do Fundo</Label>
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              value: "dots" as const,
              label: "Pontilhado",
              icon: <CircleDot className="w-4 h-4" />,
            },
            {
              value: "solid" as const,
              label: "Sólido",
              icon: <Square className="w-4 h-4" />,
            },
            {
              value: "grid" as const,
              label: "Grade",
              icon: <Grid className="w-4 h-4" />,
            },
            {
              value: "radial" as const,
              label: "Radial",
              icon: <Disc className="w-4 h-4" />,
            },
          ].map((item) => {
            const selected = theme.background === item.value;
            return (
              <button
                key={item.value}
                type="button"
                title={item.label}
                aria-label={item.label}
                onClick={() => onUpdateTheme({ background: item.value })}
                className={cn(
                  "relative flex items-center justify-center h-11 rounded-xl cursor-pointer transition-colors duration-100",
                  selected
                    ? "ds-active"
                    : "text-fg-muted hover:bg-hover hover:text-fg",
                )}
              >
                {item.icon}
              </button>
            );
          })}
        </div>
      </div>
      <div className="space-y-3">
        <Label className="mb-2">Cor primária</Label>
        <p className="text-meta text-fg-muted">
          Botões ativos e o brilho do fundo radial.
        </p>
        <div className="grid grid-cols-4 gap-2">
          {PALETTE_IDS.map((id) => {
            const preset = PALETTES[id];
            const selected = theme.palette === id;
            return (
              <button
                key={id}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                onClick={() => onUpdateTheme({ palette: id })}
                className={cn(
                  "relative flex items-center justify-center h-11 rounded-xl cursor-pointer transition-colors duration-100",
                  selected
                    ? "ds-active"
                    : "text-fg-muted hover:bg-hover hover:text-fg",
                )}
              >
                <span
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: preset.swatch }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
