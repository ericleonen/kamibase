import type { Metadata } from "next";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { ThemePicker } from "@/components/settings/ThemePicker";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Light or dark, on this device.",
};

/**
 * How the site looks on this machine.
 *
 * Signed out as well as in, and stored in this browser rather than on the
 * account, because it is a fact about the device you are reading on: the same
 * person wants dark on the laptop at night and light on the phone outdoors, and
 * syncing the two would make both wrong half the time.
 */
export default function AppearanceSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="space-y-4">
        <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        <SettingsNav current="/settings/appearance" />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold tracking-tight">Theme</h2>
        <ThemePicker />
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Kept in this browser, not on your account, so each device can be
          different.
        </p>
      </section>

      <section
        className="space-y-2 rounded-2xl p-4"
        style={{ background: "var(--surface-sunken)" }}
      >
        <h2 className="text-sm font-bold">Crease patterns stay on white paper</h2>
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Red mountains, blue valleys and a black edge only mean what they mean
          on white, and that convention is shared with every other origami tool
          there is. So in dark mode a pattern reads as a lit sheet on a dark
          table, which is also what folding one at night actually looks like.
        </p>
      </section>
    </div>
  );
}
