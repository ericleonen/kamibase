"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreasePatternEditor } from "@/components/editor/CreasePatternEditor";
import { IMPORT_STORAGE_KEY, readImportPayload, type ImportPayload } from "@/lib/upload/handoff";

/**
 * The editor, opened on a pattern the converter just produced.
 *
 * The payload only exists in the browser, so the editor is mounted after it
 * has been read rather than being handed an empty document and told to change
 * its mind. That keeps `CreasePatternEditor` free of any notion of importing:
 * it takes a document, as it always did.
 */
export function ImportedEditor() {
  const [payload, setPayload] = useState<ImportPayload | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(IMPORT_STORAGE_KEY);
    } catch {
      // Storage disabled. Handled the same as an empty handoff.
    }
    const parsed = readImportPayload(raw);
    setPayload(parsed);
    setState(parsed ? "ready" : "empty");
  }, []);

  /*
   * These two states stand in for a fullscreen tool, so they carry their own
   * screen: the editor's routes have no site chrome around them to sit inside.
   */
  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Opening the converted pattern…
        </p>
      </div>
    );
  }

  if (state === "empty" || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-sm space-y-3 text-center">
          <h1 className="text-xl font-black tracking-tight">Nothing to import</h1>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Uploads live in this browser tab only, so a reload or a new tab starts
            over.
          </p>
          <div className="flex justify-center gap-2 pt-1">
            <Link
              href="/edit"
              className="inline-block rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-85"
              style={{ background: "var(--brand)", color: "var(--ink)" }}
            >
              Draw from scratch
            </Link>
            <Link
              href="/"
              className="inline-block rounded-full px-4 py-2 text-sm font-bold transition hover:opacity-70"
              style={{ border: "1px solid var(--border-strong)" }}
            >
              Back to Kamibase
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <CreasePatternEditor
      initialDoc={payload.doc}
      title={payload.title}
      slug={payload.slug}
      {...(payload.backdrop === undefined ? {} : { backdrop: payload.backdrop })}
    />
  );
}
