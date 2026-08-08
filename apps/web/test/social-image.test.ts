import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_EDGE,
  downscaleImage,
  fitWithin,
  FOLD_PHOTO_MAX_EDGE,
  renameToJpeg,
} from "@/lib/social/image";

describe("fitWithin", () => {
  it("leaves an image smaller than the box alone rather than scaling it up into blur", () => {
    expect(fitWithin({ width: 400, height: 300 }, 1600)).toEqual({ width: 400, height: 300 });
  });

  it("scales the long edge down to the box and keeps the ratio", () => {
    expect(fitWithin({ width: 4000, height: 3000 }, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin({ width: 3000, height: 4000 }, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it("handles a square", () => {
    expect(fitWithin({ width: 2048, height: 2048 }, AVATAR_MAX_EDGE)).toEqual({
      width: 512,
      height: 512,
    });
  });

  it("never rounds a very wide image down to zero pixels", () => {
    const result = fitWithin({ width: 10_000, height: 3 }, FOLD_PHOTO_MAX_EDGE);
    expect(result.width).toBe(1600);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });

  it("returns nothing for a degenerate size instead of dividing by zero", () => {
    expect(fitWithin({ width: 0, height: 0 }, 1600)).toEqual({ width: 0, height: 0 });
    expect(fitWithin({ width: -5, height: 10 }, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("renameToJpeg", () => {
  it("swaps the extension", () => {
    expect(renameToJpeg("IMG_4021.HEIC")).toBe("IMG_4021.jpg");
    expect(renameToJpeg("crane.png")).toBe("crane.jpg");
  });

  it("adds one when there was none", () => {
    expect(renameToJpeg("photo")).toBe("photo.jpg");
  });

  it("names an extension-only file rather than producing a hidden one", () => {
    expect(renameToJpeg(".png")).toBe("photo.jpg");
  });
});

describe("downscaleImage", () => {
  it("returns the file untouched where there is no canvas, so the upload still happens", async () => {
    // Node has no `document`, which is exactly the branch under test: a slow
    // upload beats a failed one, and the server validates either way.
    const file = new File([new Uint8Array([1, 2, 3])], "crane.jpg", { type: "image/jpeg" });
    await expect(downscaleImage(file, { maxEdge: 1600 })).resolves.toBe(file);
  });
});
