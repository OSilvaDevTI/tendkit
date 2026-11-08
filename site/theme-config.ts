/** Theme presets, shared by the picker (client) and the pre-paint script (layout). */

export const COLORS = [
  { id: "green", label: "Green", swatch: "oklch(0.55 0.11 168)" },
  { id: "neutral", label: "Neutral", swatch: "oklch(0.25 0 0)" },
  { id: "blue", label: "Blue", swatch: "oklch(0.55 0.19 258)" },
  { id: "violet", label: "Violet", swatch: "oklch(0.55 0.21 292)" },
  { id: "rose", label: "Rose", swatch: "oklch(0.6 0.2 12)" },
  { id: "amber", label: "Amber", swatch: "oklch(0.72 0.15 62)" },
] as const;
export const RADII = ["0", "0.3", "0.625", "1"] as const;
export const FONTS = [
  { id: "geist", label: "Geist" },
  { id: "figtree", label: "Figtree" },
  { id: "bricolage", label: "Bricolage" },
] as const;
export const MODES = ["light", "dark", "system"] as const;

export type Theme = {
  color: (typeof COLORS)[number]["id"];
  radius: (typeof RADII)[number];
  font: (typeof FONTS)[number]["id"];
  mode: (typeof MODES)[number];
};

export const DEFAULT_THEME: Theme = { color: "green", radius: "0.625", font: "geist", mode: "system" };
export const KEY = "tendkit-theme";

/** Runs before paint (inlined in the layout) so there's no flash of the default theme. */
export const themeScript = `(function(){try{var t=Object.assign(${JSON.stringify(DEFAULT_THEME)},JSON.parse(localStorage.getItem("${KEY}")||"{}"));var d=document.documentElement;d.dataset.color=t.color;d.dataset.radius=t.radius;d.dataset.font=t.font;var m=matchMedia("(prefers-color-scheme: dark)");var a=function(){var mode=(JSON.parse(localStorage.getItem("${KEY}")||"{}").mode)||"system";d.classList.toggle("dark",mode==="dark"||(mode==="system"&&m.matches))};a();m.addEventListener("change",a)}catch(e){}})()`;

