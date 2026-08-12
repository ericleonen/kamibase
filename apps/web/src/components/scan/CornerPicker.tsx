"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Point, Quad } from "@kamibase/vision";
import { drawFitted } from "@/lib/scan/media";

/**
 * Drag the four corners of the paper.
 *
 * Automatic corner detection works on a sheet against a contrasting background
 * and fails on white paper on a white table, which is most of the photographs
 * people take of white paper. Every document scanner ever shipped therefore
 * detects a quad and then lets you drag it, and this does the same.
 *
 * It matters more here than in a document scanner. The corners define the
 * homography, the homography defines every angle in the pattern, and Kawasaki's
 * theorem is a statement about angles. A corner ten pixels out is a pattern
 * that fails its own validation for reasons that have nothing to do with how it
 * was folded.
 */

const HANDLE_RADIUS = 11;
const LOUPE_SIZE = 104;
const LOUPE_ZOOM = 3;

export function CornerPicker({
  image,
  quad,
  onChange,
}: {
  readonly image: ImageData;
  readonly quad: Quad;
  readonly onChange: (quad: Quad) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [size, setSize] = useState({ width: 640, height: 480 });

  // Keep the backing store in step with the element's box and the display's
  // pixel ratio, or the photo is soft and the handles land off by a pixel.
  useEffect(() => {
    const element = wrapper.current;
    if (!element) return;

    const measure = (): void => {
      const rect = element.getBoundingClientRect();
      const ratio = image.height / image.width;
      const width = Math.max(200, rect.width);
      setSize({ width, height: Math.round(width * ratio) });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [image.width, image.height]);

  const mapping = useCallback((): { scale: number; offsetX: number; offsetY: number } => {
    const element = canvas.current;
    if (!element) return { scale: 1, offsetX: 0, offsetY: 0 };
    const scale = Math.min(element.width / image.width, element.height / image.height);
    return {
      scale,
      offsetX: (element.width - image.width * scale) / 2,
      offsetY: (element.height - image.height * scale) / 2,
    };
  }, [image.width, image.height]);

  /* Draw the photo, dim everything outside the quad, then the handles. */
  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const context = element.getContext("2d");
    if (!context) return;

    const { scale, offsetX, offsetY } = drawFitted(element, image);
    const toCanvas = (point: Point): Point => ({
      x: point.x * scale + offsetX,
      y: point.y * scale + offsetY,
    });
    const corners = quad.map(toCanvas);

    // Everything outside the quad is not paper. Dimming it is the fastest way
    // to see that a corner is in the wrong place.
    context.save();
    context.beginPath();
    context.rect(0, 0, element.width, element.height);
    context.moveTo(corners[0]!.x, corners[0]!.y);
    for (let i = corners.length - 1; i >= 1; i -= 1) {
      context.lineTo(corners[i]!.x, corners[i]!.y);
    }
    context.closePath();
    context.fillStyle = "rgba(27, 26, 23, 0.55)";
    context.fill("evenodd");
    context.restore();

    context.beginPath();
    corners.forEach((point, i) => {
      if (i === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.closePath();
    context.strokeStyle = "#f5b72e";
    context.lineWidth = 2;
    context.stroke();

    corners.forEach((point, i) => {
      context.beginPath();
      context.arc(point.x, point.y, HANDLE_RADIUS, 0, Math.PI * 2);
      context.fillStyle = dragging === i ? "#f5b72e" : "rgba(255,255,255,0.92)";
      context.fill();
      context.lineWidth = 2.5;
      context.strokeStyle = "#1b1a17";
      context.stroke();
    });

    /*
     * A loupe while dragging. On a phone the corner being placed is under the
     * fingertip that is placing it, so without this the interaction is done
     * blind at exactly the moment precision matters.
     */
    if (dragging !== null) {
      const handle = corners[dragging]!;
      const onLeft = handle.x > element.width / 2;
      const lx = onLeft ? 16 : element.width - LOUPE_SIZE - 16;
      const ly = 16;

      context.save();
      context.beginPath();
      context.arc(lx + LOUPE_SIZE / 2, ly + LOUPE_SIZE / 2, LOUPE_SIZE / 2, 0, Math.PI * 2);
      context.clip();
      context.fillStyle = "#ffffff";
      context.fillRect(lx, ly, LOUPE_SIZE, LOUPE_SIZE);
      context.drawImage(
        element,
        handle.x - LOUPE_SIZE / (2 * LOUPE_ZOOM),
        handle.y - LOUPE_SIZE / (2 * LOUPE_ZOOM),
        LOUPE_SIZE / LOUPE_ZOOM,
        LOUPE_SIZE / LOUPE_ZOOM,
        lx,
        ly,
        LOUPE_SIZE,
        LOUPE_SIZE,
      );
      context.restore();

      context.beginPath();
      context.arc(lx + LOUPE_SIZE / 2, ly + LOUPE_SIZE / 2, LOUPE_SIZE / 2, 0, Math.PI * 2);
      context.strokeStyle = "#1b1a17";
      context.lineWidth = 2;
      context.stroke();
    }
  }, [image, quad, dragging, size]);

  const pointToImage = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>): Point => {
      const element = canvas.current!;
      const rect = element.getBoundingClientRect();
      const { scale, offsetX, offsetY } = mapping();
      const x = ((event.clientX - rect.left) * (element.width / rect.width) - offsetX) / scale;
      const y = ((event.clientY - rect.top) * (element.height / rect.height) - offsetY) / scale;
      return {
        x: Math.min(image.width, Math.max(0, x)),
        y: Math.min(image.height, Math.max(0, y)),
      };
    },
    [image.width, image.height, mapping],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    const point = pointToImage(event);
    const { scale } = mapping();
    // Generous: a fingertip is far wider than the handle it is aiming at.
    const reach = (HANDLE_RADIUS * 2.4) / Math.max(scale, 1e-6);

    let nearest = -1;
    let best = reach;
    quad.forEach((corner, i) => {
      const distance = Math.hypot(corner.x - point.x, corner.y - point.y);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    if (nearest < 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(nearest);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (dragging === null) return;
    event.preventDefault();
    const point = pointToImage(event);
    // Written back in place. Reordering while a handle is mid-drag would make
    // it jump to another corner as it crossed a diagonal.
    const next = quad.map((corner, i) => (i === dragging ? point : corner)) as unknown as Quad;
    onChange(next);
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (dragging === null) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(null);
  };

  /* Nudge the selected corner with the arrow keys, for anyone not using a
   * pointer and for the last pixel of precision with one. */
  const [focused, setFocused] = useState(0);
  const onKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>): void => {
    const step = event.shiftKey ? 10 : 1;
    const deltas: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };

    if (event.key === "Tab") return;
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setFocused((current) => (current + 1) % 4);
      return;
    }

    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    onChange(
      quad.map((corner, i) =>
        i === focused
          ? {
              x: Math.min(image.width, Math.max(0, corner.x + delta.x)),
              y: Math.min(image.height, Math.max(0, corner.y + delta.y)),
            }
          : corner,
      ) as unknown as Quad,
    );
  };

  return (
    <div ref={wrapper} className="w-full">
      <canvas
        ref={canvas}
        width={size.width}
        height={size.height}
        tabIndex={0}
        role="application"
        aria-label={
          `Paper corners. Corner ${focused + 1} of 4 is selected. ` +
          "Arrow keys move it, space selects the next one."
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="w-full touch-none rounded-2xl"
        style={{ background: "var(--surface-sunken)", border: "1px solid var(--border)" }}
      />
    </div>
  );
}
