import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { project: { findUnique: findUniqueMock } },
}));

const { slugify, uniqueSlug } = await import("@/features/projects/server/slug");

describe("slugify", () => {
  it("lowercases, strips diacritics, and dasherizes", () => {
    expect(slugify("RD Novákovci — Pezinok")).toBe("rd-novakovci-pezinok");
  });

  it("collapses non-alphanumeric runs into a single dash", () => {
    expect(slugify("Villa!!  Malinovo??")).toBe("villa-malinovo");
  });

  it("falls back to 'project' for an empty/unsafe input", () => {
    expect(slugify("   ")).toBe("project");
    expect(slugify("---")).toBe("project");
  });
});

describe("uniqueSlug", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("returns the base slug when it's free", async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(uniqueSlug("RD Novákovci")).resolves.toBe("rd-novakovci");
  });

  it("appends -2, -3, … until a free slug is found", async () => {
    findUniqueMock
      .mockResolvedValueOnce({ id: "existing-1" }) // "rd-novakovci" taken
      .mockResolvedValueOnce({ id: "existing-2" }) // "rd-novakovci-2" taken
      .mockResolvedValueOnce(null); // "rd-novakovci-3" free

    await expect(uniqueSlug("RD Novákovci")).resolves.toBe("rd-novakovci-3");
    expect(findUniqueMock).toHaveBeenCalledTimes(3);
  });
});
