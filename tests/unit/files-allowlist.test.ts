import { describe, expect, it } from "vitest";
import {
  checkAllowlist,
  getExtension,
  isPreviewable,
  isThumbnailable,
  maxUploadBytes,
} from "@/features/files/server/allowlist";

describe("getExtension", () => {
  it("extracts a lowercase extension", () => {
    expect(getExtension("Podorys_1NP.PDF")).toBe("pdf");
    expect(getExtension("plan.dwg")).toBe("dwg");
  });

  it("returns empty string when there is no extension", () => {
    expect(getExtension("README")).toBe("");
    expect(getExtension("trailing.")).toBe("");
  });
});

describe("checkAllowlist", () => {
  it("allows a PDF with the correct MIME type", () => {
    expect(checkAllowlist("zmluva.pdf", "application/pdf")).toEqual({ ok: true });
  });

  it("allows common image types", () => {
    expect(checkAllowlist("foto.jpg", "image/jpeg").ok).toBe(true);
    expect(checkAllowlist("foto.png", "image/png").ok).toBe(true);
    expect(checkAllowlist("foto.webp", "image/webp").ok).toBe(true);
  });

  it("allows office documents", () => {
    expect(
      checkAllowlist("sprava.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document").ok,
    ).toBe(true);
  });

  it("allows CAD formats by extension even with a generic octet-stream MIME type", () => {
    expect(checkAllowlist("pudorys.dwg", "application/octet-stream")).toEqual({ ok: true });
    expect(checkAllowlist("model.ifc", "application/octet-stream")).toEqual({ ok: true });
    expect(checkAllowlist("detail.dxf", "application/octet-stream")).toEqual({ ok: true });
  });

  it("allows zip archives", () => {
    expect(checkAllowlist("podklady.zip", "application/zip").ok).toBe(true);
  });

  it("rejects disallowed extensions (e.g. executables)", () => {
    const result = checkAllowlist("malware.exe", "application/octet-stream");
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not allowed/i);
  });

  it("rejects a mismatched extension/MIME combination (extension spoofing)", () => {
    const result = checkAllowlist("photo.jpg", "application/x-msdownload");
    expect(result.ok).toBe(false);
  });

  it("rejects files with no extension", () => {
    expect(checkAllowlist("noext", "application/pdf").ok).toBe(false);
  });

  it("rejects double-extension executable disguised with an allowed-looking name", () => {
    // "invoice.pdf.exe" — real extension is "exe", must be rejected regardless of the name containing "pdf".
    const result = checkAllowlist("invoice.pdf.exe", "application/pdf");
    expect(result.ok).toBe(false);
  });
});

describe("isPreviewable", () => {
  it("treats PDF and images as inline-previewable", () => {
    expect(isPreviewable("application/pdf")).toBe(true);
    expect(isPreviewable("image/png")).toBe(true);
    expect(isPreviewable("image/jpeg; charset=binary")).toBe(true);
  });

  it("treats everything else as an attachment", () => {
    expect(isPreviewable("application/msword")).toBe(false);
    expect(isPreviewable("application/octet-stream")).toBe(false);
    expect(isPreviewable("application/zip")).toBe(false);
  });
});

describe("isThumbnailable", () => {
  it("accepts raster image types sharp can handle", () => {
    expect(isThumbnailable("image/jpeg")).toBe(true);
    expect(isThumbnailable("image/png")).toBe(true);
    expect(isThumbnailable("image/webp")).toBe(true);
  });

  it("rejects svg/heic and non-images", () => {
    expect(isThumbnailable("image/svg+xml")).toBe(false);
    expect(isThumbnailable("application/pdf")).toBe(false);
  });
});

describe("maxUploadBytes", () => {
  it("derives bytes from MAX_UPLOAD_MB", () => {
    const prev = process.env.MAX_UPLOAD_MB;
    process.env.MAX_UPLOAD_MB = "10";
    expect(maxUploadBytes()).toBe(10 * 1024 * 1024);
    process.env.MAX_UPLOAD_MB = prev;
  });

  it("falls back to 500MB for invalid/missing values", () => {
    const prev = process.env.MAX_UPLOAD_MB;
    process.env.MAX_UPLOAD_MB = "not-a-number";
    expect(maxUploadBytes()).toBe(500 * 1024 * 1024);
    process.env.MAX_UPLOAD_MB = prev;
  });
});
