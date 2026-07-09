// Shared color palettes for the app's inline-style theming.
// Each named palette has a dark and light variant; see src/lib/theme.tsx for
// how the active variant is picked (localStorage choice, falling back to OS).
import type { ThemeMode } from "./theme";

export type Palette = {
  bg: string; panel: string; panel2: string; border: string; text: string; muted: string;
  heading: string; link: string; pill: string; pillText: string; orange: string;
  accent: string; accentText: string; error: string; ok: string;
};

// Community + post pages, and the login/setup screens: black & golden-jaguar.
// Not exported directly — consumers use goldPair[mode] below.
const gold: Palette = {
  bg: "#0B0B0F", panel: "#15141a", panel2: "#1F1E26", border: "#2e2b22",
  text: "#ECE8DF", muted: "#9b9488", heading: "#C8A24A", link: "#57D7E3",
  pill: "#221f18", pillText: "#cdbf9c", orange: "#FF4500", accent: "#C8A24A",
  accentText: "#15110a", error: "#e0726b", ok: "#8fce9b",
};

const goldLight: Palette = {
  bg: "#FAF7F0", panel: "#FFFFFF", panel2: "#F1EAD9", border: "#E3D9BE",
  text: "#231F14", muted: "#6B6355", heading: "#8A6A1E", link: "#0E7A88",
  pill: "#F1EAD9", pillText: "#5C5340", orange: "#FF4500", accent: "#C8A24A",
  accentText: "#15110a", error: "#C4463D", ok: "#2F7D46",
};

// Member page: neutral Reddit-dark (unchanged), by request.
const neutral: Palette = {
  bg: "#0b0b0c", panel: "#161617", panel2: "#1d1d1f", border: "#2b2b2d",
  text: "#d7dadc", muted: "#838488", heading: "#d7dadc", link: "#7cb3ff",
  pill: "#272729", pillText: "#b8b9bb", orange: "#ff4500", accent: "#ff4500",
  accentText: "#ffffff", error: "#e0726b", ok: "#8fce9b",
};

const neutralLight: Palette = {
  bg: "#FFFFFF", panel: "#F6F7F8", panel2: "#EDEEF0", border: "#CCCCCC",
  text: "#1A1A1B", muted: "#5F6368", heading: "#1A1A1B", link: "#0079D3",
  pill: "#F0F1F3", pillText: "#4A4D50", orange: "#ff4500", accent: "#ff4500",
  accentText: "#ffffff", error: "#C4463D", ok: "#2F7D46",
};

// Dark/light pairs, keyed by ThemeMode, so callers do `pair[mode]` instead of
// repeating a `mode === "light" ? x : y` ternary at every use site.
export const goldPair: Record<ThemeMode, Palette> = { dark: gold, light: goldLight };
export const neutralPair: Record<ThemeMode, Palette> = { dark: neutral, light: neutralLight };

// Decorative gradient behind the paw emoji on the auth screens.
export const pawGradient: Record<ThemeMode, string> = {
  dark: "radial-gradient(circle at 35% 30%, #2a2a2e, #050505)",
  light: "radial-gradient(circle at 35% 30%, #ffffff, #e3d9be)",
};
