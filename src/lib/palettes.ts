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

// ----- Profile themes (migration 0027) --------------------------------------
// Curated accent presets a member can pick for their own profile page.
// A preset overrides only accent-level keys (accent/accentText/heading/link)
// on top of the visitor's mode-appropriate base palette — bg/panel/text/muted
// always stay with the light/dark mode choice, so a theme can never fight the
// dark-mode toggle or hurt body-text contrast. Each preset carries separate
// dark and light accent values (brighter accents on dark, deeper on light).
// Slugs must stay in sync with the profiles_profile_theme_check constraint.

type AccentOverride = Pick<Palette, "accent" | "accentText" | "heading" | "link">;

export type ProfileThemePreset = {
  label: string;
  dark: AccentOverride;
  light: AccentOverride;
  headerGradient: Record<ThemeMode, string>; // profile sidebar banner tint
};

export const PROFILE_THEMES: Record<string, ProfileThemePreset> = {
  vibranium: {
    label: "Vibranium",
    dark: { accent: "#A78BFA", accentText: "#17112B", heading: "#C4B5FD", link: "#A78BFA" },
    light: { accent: "#6D28D9", accentText: "#FFFFFF", heading: "#5B21B6", link: "#6D28D9" },
    headerGradient: {
      dark: "linear-gradient(135deg,#4C3A8A,#1E1533)",
      light: "linear-gradient(135deg,#EDE9FE,#C4B5FD)",
    },
  },
  gold: {
    label: "Golden Jaguar",
    dark: { accent: "#C8A24A", accentText: "#15110A", heading: "#C8A24A", link: "#D9B968" },
    light: { accent: "#C8A24A", accentText: "#15110A", heading: "#8A6A1E", link: "#8A6A1E" },
    headerGradient: {
      dark: "linear-gradient(135deg,#6B5620,#241C09)",
      light: "linear-gradient(135deg,#F1EAD9,#D9C283)",
    },
  },
  dora: {
    label: "Dora Milaje",
    dark: { accent: "#F27B72", accentText: "#2B0F0D", heading: "#F08C84", link: "#F08C84" },
    light: { accent: "#B3261E", accentText: "#FFFFFF", heading: "#8F1D17", link: "#B3261E" },
    headerGradient: {
      dark: "linear-gradient(135deg,#7A2520,#2A0E0C)",
      light: "linear-gradient(135deg,#FADCDA,#E9A29C)",
    },
  },
  river: {
    label: "River Tribe",
    dark: { accent: "#4FC3D9", accentText: "#06272D", heading: "#7AD4E4", link: "#7AD4E4" },
    light: { accent: "#0E7A88", accentText: "#FFFFFF", heading: "#0B5E69", link: "#0E7A88" },
    headerGradient: {
      dark: "linear-gradient(135deg,#155E6B,#08222A)",
      light: "linear-gradient(135deg,#D7F0F4,#8ED4E0)",
    },
  },
  herb: {
    label: "Heart-Shaped Herb",
    dark: { accent: "#7ECF8F", accentText: "#0D2412", heading: "#98DBA5", link: "#98DBA5" },
    light: { accent: "#2F7D46", accentText: "#FFFFFF", heading: "#256238", link: "#2F7D46" },
    headerGradient: {
      dark: "linear-gradient(135deg,#2C5E3A,#0E2415)",
      light: "linear-gradient(135deg,#DDF2E2,#93D6A4)",
    },
  },
};

// Base palette + preset accents for the given mode. Unknown/null slugs fall
// through to the base, so a stale DB value degrades to the default look.
export function applyProfileTheme(base: Palette, slug: string | null | undefined, mode: ThemeMode): Palette {
  const preset = slug ? PROFILE_THEMES[slug] : undefined;
  return preset ? { ...base, ...preset[mode] } : base;
}

export function profileHeaderGradient(slug: string | null | undefined, mode: ThemeMode): string | null {
  return (slug && PROFILE_THEMES[slug]?.headerGradient[mode]) || null;
}
