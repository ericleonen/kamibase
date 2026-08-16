import { describe, expect, it } from "vitest";
import { ACCEPTED, isMediaFile } from "@/lib/upload/prepare";

/**
 * Which of the two pipelines a file goes down.
 *
 * This one decision is worth a test of its own because getting it wrong is
 * silent in exactly the wrong direction: an SVG sent to the crease detector
 * comes back as "the source image could not be decoded", which reads as a
 * broken drawing rather than as a misrouted one.
 */

function file(name: string, type: string): File {
  return new File(["x"], name, { type });
}

describe("isMediaFile", () => {
  it("treats an SVG as a drawing, whatever the file dialog calls it", () => {
    // Every browser reports `image/svg+xml` here, so a bare startsWith("image/")
    // is wrong for the one text format that is also an image type.
    expect(isMediaFile(file("crane.svg", "image/svg+xml"))).toBe(false);
    expect(isMediaFile(file("crane.SVG", "image/svg+xml"))).toBe(false);
    expect(isMediaFile(file("crane.svg", ""))).toBe(false);
  });

  it("treats photographs and video as media", () => {
    expect(isMediaFile(file("paper.jpg", "image/jpeg"))).toBe(true);
    expect(isMediaFile(file("paper.heic", "image/heic"))).toBe(true);
    expect(isMediaFile(file("paper.mov", "video/quicktime"))).toBe(true);
  });

  it("falls back to the extension where the browser gives no type", () => {
    expect(isMediaFile(file("paper.JPG", ""))).toBe(true);
    expect(isMediaFile(file("paper.mp4", ""))).toBe(true);
  });

  it("leaves the crease formats alone, which arrive with no type at all", () => {
    for (const name of ["bird.fold", "bird.kami", "bird.cp", "bird.opx"]) {
      expect(isMediaFile(file(name, ""))).toBe(false);
    }
  });
});

describe("ACCEPTED", () => {
  it("offers both halves of the flow in one picker", () => {
    for (const part of [".fold", ".cp", ".opx", ".svg", "image/*", "video/*"]) {
      expect(ACCEPTED).toContain(part);
    }
  });
});
