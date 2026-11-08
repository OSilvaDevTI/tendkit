/** Theme presets, shared by the picker (client) and the pre-paint script (layout). */

/** Each preset's primary color as [lightness, chroma] for light and dark mode, around one hue. Mirrors globals.css. */
export const COLORS = [
  { id: "neutral", label: "Neutral", swatch: "oklch(0.25 0 0)", hue: 260, light: [0.21, 0], dark: [0.93, 0] },
  { id: "green", label: "Green", swatch: "oklch(0.55 0.11 168)", hue: 168, light: [0.47, 0.1], dark: [0.74, 0.12] },
  { id: "blue", label: "Blue", swatch: "oklch(0.55 0.19 258)", hue: 258, light: [0.52, 0.19], dark: [0.72, 0.14] },
  { id: "violet", label: "Violet", swatch: "oklch(0.55 0.21 292)", hue: 292, light: [0.52, 0.21], dark: [0.74, 0.15] },
  { id: "rose", label: "Rose", swatch: "oklch(0.6 0.2 12)", hue: 12, light: [0.57, 0.2], dark: [0.74, 0.15] },
  { id: "amber", label: "Amber", swatch: "oklch(0.72 0.15 62)", hue: 62, light: [0.6, 0.15], dark: [0.8, 0.15] },
] as const;
export const RADII = ["0", "0.3", "0.625", "1"] as const;
export const FONTS = [
  { id: "geist", label: "Geist", family: "Geist" },
  { id: "figtree", label: "Figtree", family: "Figtree" },
  { id: "bricolage", label: "Bricolage", family: "Bricolage Grotesque" },
] as const;
export const MODES = ["light", "dark", "system"] as const;

export type Theme = {
  color: (typeof COLORS)[number]["id"];
  radius: (typeof RADII)[number];
  font: (typeof FONTS)[number]["id"];
  mode: (typeof MODES)[number];
};

export const DEFAULT_THEME: Theme = { color: "neutral", radius: "0.625", font: "geist", mode: "system" };
export const KEY = "tendkit-theme";

/** Runs before paint (inlined in the layout) so there's no flash of the default theme. */
export const themeScript = `(function(){try{var t=Object.assign(${JSON.stringify(DEFAULT_THEME)},JSON.parse(localStorage.getItem("${KEY}")||"{}"));var d=document.documentElement;d.dataset.color=t.color;d.dataset.radius=t.radius;d.dataset.font=t.font;var m=matchMedia("(prefers-color-scheme: dark)");var a=function(){var mode=(JSON.parse(localStorage.getItem("${KEY}")||"{}").mode)||"system";d.classList.toggle("dark",mode==="dark"||(mode==="system"&&m.matches))};a();m.addEventListener("change",a)}catch(e){}})()`;


/** The CSS a visitor would paste into their app for the current theme. */
export function themeCss(theme: Theme) {
  const c = COLORS.find((x) => x.id === theme.color) ?? COLORS[0];
  const fmt = ([l, ch]: readonly [number, number]) => `oklch(${l} ${ch} ${c.hue})`;
  const font = FONTS.find((f) => f.id === theme.font) ?? FONTS[0];
  return `/* app/globals.css */
:root {
  --primary: ${fmt(c.light)};
  --primary-foreground: oklch(0.985 0 0);
  --ring: ${fmt(c.light)};
  --radius: ${theme.radius}rem;
}

.dark {
  --primary: ${fmt(c.dark)};
  --primary-foreground: oklch(0.17 0 0);
  --ring: ${fmt(c.dark)};
}

/* Font: ${font.family}, through next/font as --font-sans. */`;
}
