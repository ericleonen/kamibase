"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { applyTheme, readTheme, THEMES, type Theme } from "@/lib/theme";

const LABELS: Record<Theme, { label: string; Icon: typeof Sun; hint: string }> = {
  system: { label: "System", Icon: Monitor, hint: "Follow this device" },
  light: { label: "Light", Icon: Sun, hint: "Always light" },
  dark: { label: "Dark", Icon: Moon, hint: "Always dark" },
};

/**
 * Light, dark, or whatever the machine says.
 *
 * Applied the instant it is chosen, with no Save button: the setting *is* the
 * page changing colour, and a confirmation step for something you can see
 * happen would be one click of ceremony for no information.
 *
 * Read after mount rather than during render, so the server's markup and the
 * first client render agree; before that the buttons are simply unselected for
 * a frame, which nobody sees.
 */
export function ThemePicker() {
  const [choice, setChoice] = useState<Theme | null>(null);

  useEffect(() => setChoice(readTheme()), []);

  // "System" is a standing instruction, not a one-off, so the page follows the
  // machine when it flips at sunset.
  useEffect(() => {
    if (choice !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = (): void => applyTheme("system");
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [choice]);

  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Theme">
      {THEMES.map((theme) => {
        const { label, Icon, hint } = LABELS[theme];
        const active = choice === theme;
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              setChoice(theme);
              applyTheme(theme);
            }}
            className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition"
            style={{
              background: active ? "var(--surface-sunken)" : "transparent",
              border: `1px solid ${active ? "var(--border-strong)" : "var(--border)"}`,
            }}
          >
            <Icon
              className="size-5 shrink-0"
              style={{ color: active ? "var(--brand-strong)" : "var(--text-muted)" }}
              aria-hidden
            />
            <span className="min-w-0">
              <span className="block text-sm font-bold">{label}</span>
              <span className="block text-xs" style={{ color: "var(--text-muted)" }}>
                {hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
