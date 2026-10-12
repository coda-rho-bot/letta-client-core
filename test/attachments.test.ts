import { describe, expect, it } from "bun:test";
import {
  downscaleDimensions,
  intakeBatch,
  JPEG_QUALITY,
  MAX_ATTACHMENTS,
  MAX_EDGE,
  MAX_SOURCE_BYTES,
  overSourceLimit,
  toImageContent,
  wireContent,
  type AttachmentPayload,
} from "../src/attachments.js";

const payload = (extra: Partial<AttachmentPayload> = {}): AttachmentPayload => ({
  data: "aGVsbG8=",
  mediaType: "image/jpeg",
  ...extra,
});

describe("intake constants", () => {
  it("pins the shared policy numbers", () => {
    expect(MAX_EDGE).toBe(1600);
    expect(JPEG_QUALITY).toBe(0.8);
    expect(MAX_SOURCE_BYTES).toBe(25 * 1024 * 1024);
    expect(MAX_ATTACHMENTS).toBe(4);
  });
});

describe("downscaleDimensions", () => {
  it("returns null when the image already fits", () => {
    expect(downscaleDimensions(800, 600)).toBeNull();
    expect(downscaleDimensions(1600, 900)).toBeNull();
  });

  it("downscales a landscape image on the width axis", () => {
    expect(downscaleDimensions(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  });

  it("downscales a portrait image on the height axis", () => {
    expect(downscaleDimensions(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });
});

describe("overSourceLimit", () => {
  it("guards the boundary exactly", () => {
    expect(overSourceLimit(MAX_SOURCE_BYTES)).toBe(false);
    expect(overSourceLimit(MAX_SOURCE_BYTES + 1)).toBe(true);
  });
});

describe("toImageContent", () => {
  it("builds SDK base64 image parts with no data: prefix", () => {
    expect(toImageContent([payload({ data: "abc", mediaType: "image/jpeg" })])).toEqual([
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "abc" },
      },
    ]);
  });
});

describe("wireContent", () => {
  it("keeps plain text as a plain string", () => {
    expect(wireContent("build it", [])).toBe("build it");
  });

  it("puts images ahead of the instruction text", () => {
    const wire = wireContent("describe", [payload({ data: "abc" })]);
    expect(Array.isArray(wire)).toBe(true);
    const parts = wire as Exclude<ReturnType<typeof wireContent>, string>;
    expect(parts[0]).toMatchObject({ type: "image" });
    expect(parts[1]).toEqual({ type: "text", text: "describe" });
  });

  it("images-only sends without a text part", () => {
    const wire = wireContent("", [payload({ data: "abc" })]);
    const parts = wire as Exclude<ReturnType<typeof wireContent>, string>;
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ type: "image" });
  });
});

describe("intakeBatch", () => {
  const label = (path: string) => path.split("/").pop() ?? path;

  it("intakes in order and reports nothing on a clean batch", () => {
    const result = intakeBatch(["a", "b"], (path) => `view-${path}`, label);
    expect(result).toEqual({ attachments: ["view-a", "view-b"], skipped: [] });
  });

  it("caps at the limit and reports the overflow with reasons", () => {
    const paths = ["1", "2", "3", "4", "5", "6"];
    const result = intakeBatch(paths, (path) => `view-${path}`, label);
    expect(result.attachments).toEqual(["view-1", "view-2", "view-3", "view-4"]);
    expect(result.skipped).toEqual([
      "5 — over the 4-image limit",
      "6 — over the 4-image limit",
    ]);
  });

  it("skips unreadable files without dropping the rest of the batch", () => {
    const result = intakeBatch(
      ["bad", "good"],
      (path) => {
        if (path === "bad") throw new Error("bad could not be read as an image");
        return `view-${path}`;
      },
      label,
    );
    expect(result).toEqual({
      attachments: ["view-good"],
      skipped: ["bad could not be read as an image"],
    });
  });
});
