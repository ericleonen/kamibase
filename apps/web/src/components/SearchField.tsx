"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import {
  clearSearches,
  forgetSearch,
  matchSearches,
  readSearches,
  rememberSearch,
} from "@/lib/searches";

/**
 * The search box, with its own suggestions.
 *
 * Still a plain GET form pointed at `/explore`, so it works with JavaScript
 * off. Everything below is what JavaScript adds: the browser's own autofill
 * dropdown is turned off (`autoComplete="off"`) and replaced with a list of
 * what *this site* was searched for, held in `localStorage`.
 *
 * Wired as a combobox, which is the only way a dropdown attached to a text
 * field is announced correctly: `aria-activedescendant` moves the screen
 * reader's attention through the options while focus stays in the input, so
 * typing never stops working.
 */
export function SearchField({ query = "" }: { readonly query?: string }) {
  const router = useRouter();
  const listId = useId();
  const optionId = (index: number): string => `${listId}-${index}`;

  const [value, setValue] = useState(query);
  const [history, setHistory] = useState<readonly string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  /*
   * Has anything been typed since the box was focused?
   *
   * Clicking into a search box that still holds the last query is how somebody
   * starts a *new* search, so the whole history is offered until they type. Only
   * once they do does the list narrow to what matches, which is the moment the
   * filtering is useful rather than in the way.
   */
  const [typed, setTyped] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  // Read after mount, so the server's markup and the first client render agree.
  useEffect(() => setHistory(readSearches()), []);

  const suggestions = !open ? [] : typed ? matchSearches(history, value) : history;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const go = useCallback(
    (next: string) => {
      const trimmed = next.trim();
      setOpen(false);
      setActive(-1);
      setTyped(false);
      if (!trimmed) return;
      setHistory(rememberSearch(trimmed));
      setValue(trimmed);
      input.current?.blur();
      router.push(`/explore?q=${encodeURIComponent(trimmed)}`);
    },
    [router],
  );

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setOpen(false);
      setActive(-1);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!open && history.length > 0) {
        setOpen(true);
        return;
      }
      if (suggestions.length === 0) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Past either end lands back on the input, which is where the text you
      // were typing still is.
      const next = active + step;
      setActive(next < -1 ? suggestions.length - 1 : next >= suggestions.length ? -1 : next);
      return;
    }
    if (event.key === "Enter") {
      const picked = active >= 0 ? suggestions[active] : undefined;
      // The form would submit and navigate on its own; taking it here keeps the
      // whole thing a client navigation and records the search either way.
      event.preventDefault();
      go(picked ?? value);
    }
  }

  return (
    <div className="relative min-w-0 flex-1" ref={container}>
      <form
        action="/explore"
        onSubmit={(event) => {
          event.preventDefault();
          go(value);
        }}
      >
        <label className="sr-only" htmlFor="site-search">
          Search patterns
        </label>
        {/* `kami-search` moves the focus ring onto the whole pill; see
            globals.css. */}
        <div
          className="kami-search flex items-center gap-2 rounded-full px-4 py-2"
          style={{ background: "var(--surface-sunken)" }}
        >
          <Search className="size-4 shrink-0" style={{ color: "var(--text-muted)" }} aria-hidden />
          <input
            ref={input}
            id="site-search"
            name="q"
            type="search"
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setActive(-1);
              setTyped(true);
              setOpen(true);
            }}
            onFocus={() => {
              setTyped(false);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search bases, tessellations, designers…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--text-faint)]"
            /* Ours, not the browser's. */
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            {...(active >= 0 ? { "aria-activedescendant": optionId(active) } : {})}
          />
        </div>
      </form>

      {suggestions.length > 0 && (
        <div
          className="kami-pop absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-2xl p-1.5"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card-hover)",
            transformOrigin: "top center",
          }}
        >
          <ul id={listId} role="listbox" aria-label="Recent searches">
            {suggestions.map((suggestion, index) => (
              <li key={suggestion}>
                <div
                  id={optionId(index)}
                  role="option"
                  aria-selected={index === active}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
                  style={{
                    background: index === active ? "var(--surface-sunken)" : "transparent",
                  }}
                  onMouseEnter={() => setActive(index)}
                >
                  <Clock
                    className="size-3.5 shrink-0"
                    style={{ color: "var(--text-faint)" }}
                    aria-hidden
                  />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left"
                    onClick={() => go(suggestion)}
                  >
                    {suggestion}
                  </button>
                  <button
                    type="button"
                    title={`Forget "${suggestion}"`}
                    aria-label={`Forget "${suggestion}"`}
                    className="shrink-0 rounded-md p-1 transition hover:opacity-60"
                    style={{ color: "var(--text-faint)" }}
                    onClick={() => {
                      setHistory(forgetSearch(suggestion));
                      setActive(-1);
                      input.current?.focus();
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-1 border-t pt-1" style={{ borderColor: "var(--border)" }}>
            <button
              type="button"
              className="w-full rounded-xl px-3 py-1.5 text-left text-xs transition hover:opacity-60"
              style={{ color: "var(--text-muted)" }}
              onClick={() => {
                setHistory(clearSearches());
                setOpen(false);
                input.current?.focus();
              }}
            >
              Clear recent searches
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
