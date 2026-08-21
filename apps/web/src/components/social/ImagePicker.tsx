"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { downscaleImage, type DownscaleOptions } from "@/lib/social/image";
import { formatBytes } from "@/lib/social/validate";

/**
 * Pick a photo, shrink it, preview it.
 *
 * The shrinking is the point. A phone camera produces 4 to 12MB and none of
 * that resolution survives a 600px card, so the file is re-encoded to a JPEG
 * that fits `maxEdge` before it ever leaves the device. A fold posted over
 * mobile data then uploads in about a second.
 *
 * The resized file is written back into the input through a `DataTransfer`, so
 * the form still submits normally and the server action receives it as an
 * ordinary `File`. Nothing here is a security control: the action re-checks the
 * type and size, and the storage bucket checks a third time.
 */
export function ImagePicker({
  name,
  label,
  hint,
  required = false,
  maxEdge,
  quality,
  shape = "rectangle",
  currentUrl,
}: {
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly maxEdge: number;
  readonly quality?: number;
  readonly shape?: "rectangle" | "circle";
  readonly currentUrl?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  // Object URLs hold the decoded image alive until they are revoked.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onChange(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      setPreview(null);
      setNote(null);
      return;
    }

    setWorking(true);
    const options: DownscaleOptions = {
      maxEdge,
      ...(quality === undefined ? {} : { quality }),
    };
    const resized = await downscaleImage(file, options);

    // Put the smaller file back where the form will find it.
    if (resized !== file && input.current) {
      const transfer = new DataTransfer();
      transfer.items.add(resized);
      input.current.files = transfer.files;
    }

    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return URL.createObjectURL(resized);
    });
    setNote(
      resized === file
        ? formatBytes(file.size)
        : `${formatBytes(file.size)} resized to ${formatBytes(resized.size)}`,
    );
    setWorking(false);
  }

  const shown = preview ?? currentUrl ?? null;
  const frame =
    shape === "circle"
      ? "size-24 rounded-full"
      : "aspect-[4/3] w-full max-w-sm rounded-2xl";

  return (
    <div className="space-y-2">
      <span className="block text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>

      <div className="flex items-center gap-4">
        <div
          className={`${frame} flex shrink-0 items-center justify-center overflow-hidden`}
          style={{
            background: "var(--surface-sunken)",
            // The circle is an avatar, so it wears the same black ring the
            // avatar will once it is saved. Anything else previews a picture
            // that does not look like the one everybody else sees.
            border: shape === "circle" ? "3px solid var(--ink)" : "1px solid var(--border)",
          }}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob: or a Storage URL
            <img src={shown} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-6" style={{ color: "var(--text-faint)" }} aria-hidden />
          )}
        </div>

        <div className="min-w-0 space-y-1">
          <input
            ref={input}
            type="file"
            name={name}
            required={required}
            accept="image/jpeg,image/png,image/webp"
            onChange={onChange}
            className="block w-full text-xs file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-[var(--surface-sunken)] file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-[var(--text)]"
          />
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {working ? "Resizing…" : (note ?? hint ?? "JPEG, PNG or WebP.")}
          </p>
        </div>
      </div>
    </div>
  );
}
