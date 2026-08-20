"use client";

import { useEffect, useState } from "react";

/**
 * "⌘" on Apple hardware, "Ctrl" everywhere else, for shortcut hints.
 *
 * Resolved in an effect rather than during render: the server has no idea what
 * keyboard you have, and a render-time guess would hydrate into a mismatch.
 * "Ctrl" is the first paint on every platform, which is the harmless way round
 * It is right for most visitors and wrong for a single frame for the rest.
 */
export function useModifierLabel(): string {
  const [label, setLabel] = useState("Ctrl");
  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) setLabel("⌘");
  }, []);
  return label;
}
