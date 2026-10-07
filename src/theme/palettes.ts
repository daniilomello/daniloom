import { PaletteId, ThemeMode } from "../types";

export type PaletteTone = {
  primary: string;
  primaryHover: string;
  onPrimary: string;
};

export const PALETTES: Record<
  PaletteId,
  { label: string; swatch: string; light: PaletteTone; dark: PaletteTone }
> = {
  neutral: {
    label: "Neutro",
    swatch: "#a1a1aa",
    light: {
      primary: "#18181b",
      primaryHover: "#27272a",
      onPrimary: "#fafafa",
    },
    dark: {
      primary: "#f4f4f5",
      primaryHover: "#ffffff",
      onPrimary: "#18181b",
    },
  },
  warm: {
    label: "Roxo",
    swatch: "#bf15f2",
    light: {
      primary: "#9300c4",
      primaryHover: "#7a00a3",
      onPrimary: "#fafafa",
    },
    dark: {
      primary: "#bf15f2",
      primaryHover: "#d24dff",
      onPrimary: "#fafafa",
    },
  },
  olive: {
    label: "Oliva",
    swatch: "#65a30d",
    light: {
      primary: "#3f6212",
      primaryHover: "#365314",
      onPrimary: "#f7fee7",
    },
    dark: {
      primary: "#a3e635",
      primaryHover: "#bef264",
      onPrimary: "#142004",
    },
  },
  // id "chalk" mantido para não quebrar preferências salvas
  chalk: {
    label: "Índigo",
    swatch: "#3b46ac",
    light: {
      primary: "#3b46ac",
      primaryHover: "#313a91",
      onPrimary: "#fafafa",
    },
    dark: {
      primary: "#4f5ac4",
      primaryHover: "#6670d4",
      onPrimary: "#fafafa",
    },
  },
};

export const PALETTE_IDS = Object.keys(PALETTES) as PaletteId[];

export function paletteTone(id: PaletteId, mode: ThemeMode): PaletteTone {
  return PALETTES[id]?.[mode] ?? PALETTES.neutral[mode];
}
