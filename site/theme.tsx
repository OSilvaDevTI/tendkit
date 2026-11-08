"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLORS, DEFAULT_THEME, FONTS, KEY, MODES, RADII, type Theme } from "./theme-config";

/*
 * The site's theme: the same knobs a shadcn/ui app has (color, radius, font, mode). It's stored
 * per visitor and applied to <html>, so the hero, the embedded inbox and the demo restyle live.
 */


let current: Theme = DEFAULT_THEME;
let loaded = false;
const listeners = new Set<() => void>();

function read(): Theme {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      current = { ...DEFAULT_THEME, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
    } catch {
      current = DEFAULT_THEME;
    }
  }
  return current;
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.dataset.color = theme.color;
  root.dataset.radius = theme.radius;
  root.dataset.font = theme.font;
  const dark = theme.mode === "dark" || (theme.mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  window.setTimeout(() => root.classList.remove("theme-transition"), 260);
}

export function setTheme(patch: Partial<Theme>) {
  current = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Private mode: the theme still applies for this visit.
  }
  apply(current);
  listeners.forEach((l) => l());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    read,
    () => DEFAULT_THEME
  );
}

/** The full picker: color, radius, font and mode. */
export function ThemePicker({ className }: { className?: string }) {
  const theme = useTheme();
  return (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-3 text-sm", className)}>
      <Group label="Color">
        {COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setTheme({ color: c.id })}
            aria-pressed={theme.color === c.id}
            aria-label={c.label}
            title={c.label}
            className={cn(
              "grid size-7 place-items-center rounded-full border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring",
              theme.color === c.id && "border-foreground/80"
            )}
          >
            <span className="size-4.5 rounded-full" style={{ background: c.swatch }} />
          </button>
        ))}
      </Group>
      <Group label="Radius">
        <Segmented
          value={theme.radius}
          options={RADII.map((r) => ({ id: r, label: r }))}
          onChange={(radius) => setTheme({ radius: radius as Theme["radius"] })}
        />
      </Group>
      <Group label="Font">
        <Segmented
          value={theme.font}
          options={FONTS.map((f) => ({ id: f.id, label: f.label }))}
          onChange={(font) => setTheme({ font: font as Theme["font"] })}
        />
      </Group>
      <Group label="Mode">
        <ModeSwitch />
      </Group>
    </div>
  );
}

/** Light, dark or follow the system. Also used in the header. */
export function ModeSwitch() {
  const { mode } = useTheme();
  const icons = { light: Sun, dark: Moon, system: Monitor } as const;
  return (
    <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Color mode">
      {MODES.map((m) => {
        const Icon = icons[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => setTheme({ mode: m })}
            aria-pressed={mode === m}
            aria-label={`${m[0]!.toUpperCase()}${m.slice(1)} mode`}
            className={cn(
              "grid size-7 place-items-center rounded-[calc(var(--radius)-2px)] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              mode === m && "bg-accent text-foreground"
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5" role="group" aria-label={label}>
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: { id: string; label: string }[]; onChange: (id: string) => void }) {
  return (
    <div className="inline-flex rounded-md border p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={cn(
            "h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
            value === o.id && "bg-accent font-medium text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
