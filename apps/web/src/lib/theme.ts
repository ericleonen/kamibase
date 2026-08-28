/**
 * Light, dark, or whatever the machine says.
 *
 * Kept in `localStorage` rather than on the account, because it is a fact about
 * the device you are reading on and not about you: the same person wants dark
 * on the laptop at night and light on the phone outdoors, and syncing the two
 * would make both wrong half the time. It also means the preference works
 * signed out, which the rest of the site does too.
 */

export const THEME_KEY = "kamibase:theme";

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return value === "system" || value === "light" || value === "dark";
}

/** What the page should actually be, given a choice and the machine. */
export function resolveTheme(choice: Theme, prefersDark: boolean): "light" | "dark" {
  if (choice === "system") return prefersDark ? "dark" : "light";
  return choice;
}

export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    // Private mode, or storage is blocked. The machine's preference is a fine
    // answer and the script below will still follow it.
    return "system";
  }
}

/**
 * Stamp the root and remember the choice.
 *
 * The attribute is always written, even for "system", so the stylesheet needs
 * one dark block instead of two. See the note in globals.css.
 */
export function applyTheme(choice: Theme): void {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset["theme"] = resolveTheme(choice, prefersDark);
  try {
    window.localStorage.setItem(THEME_KEY, choice);
  } catch {
    // The page is already the right colour; only the memory of it is lost.
  }
}

/**
 * The same logic, as a string, to run in `<head>` before anything paints.
 *
 * Inline and synchronous on purpose. Anything deferred, imported or hydrated
 * happens after the first paint, and a white flash on the way into a dark page
 * is the one bug every themed site ships at least once.
 *
 * It is written by hand rather than generated from the functions above because
 * it has to survive being minified into an attribute and cannot import
 * anything; `test/theme.test.ts` checks the two against each other.
 */
export const THEME_SCRIPT = `(function(){try{
var c=localStorage.getItem(${JSON.stringify(THEME_KEY)});
if(c!=='light'&&c!=='dark'&&c!=='system')c='system';
var d=c==='dark'||(c==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.dataset.theme=d?'dark':'light';
}catch(e){document.documentElement.dataset.theme='light';}})();`;
