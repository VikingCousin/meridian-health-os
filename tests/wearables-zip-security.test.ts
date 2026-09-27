import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { extractSupportedFiles, isZipFile, isPathSafe } from "@/lib/wearables/importers/zip-utils";

async function buildZip(entries: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "uint8array" });
}

describe("zip extraction security", () => {
  it("extracts supported files from a well-formed archive", async () => {
    const bytes = await buildZip({ "HEARTRATE_AUTO.csv": "date,heartRate\n2026-01-01,58\n", "readme.txt": "hello" });
    const files = await extractSupportedFiles(bytes);
    expect(files.map((f) => f.name).sort()).toEqual(["HEARTRATE_AUTO.csv", "readme.txt"]);
  });

  it("silently skips unsupported (non-allowlisted) file types rather than extracting them", async () => {
    const bytes = await buildZip({ "SLEEP.csv": "id,start,stop\n1,2026-01-01,2026-01-02\n", "profile.jpg": "not really a jpeg but irrelevant" });
    const files = await extractSupportedFiles(bytes);
    expect(files.map((f) => f.name)).toEqual(["SLEEP.csv"]);
  });

  // JSZip's own `.file(name, ...)` API silently sanitizes an obviously
  // hostile name (e.g. "../../etc/passwd.csv" -> "etc/passwd.csv") at write
  // time, which makes it awkward to build a genuinely traversal-pathed
  // archive through the public API just to exercise our own check. The
  // zip-slip guard itself (isPathSafe) is exported and tested directly
  // against hostile strings instead — this is what extractSupportedFiles()
  // calls for every entry it reads, regardless of how the archive was produced.
  it("flags relative path-traversal entries as unsafe", () => {
    expect(isPathSafe("../../etc/passwd.csv")).toBe(false);
    expect(isPathSafe("subdir/../../evil.csv")).toBe(false);
  });

  it("flags absolute paths as unsafe", () => {
    expect(isPathSafe("/etc/evil.csv")).toBe(false);
  });

  it("accepts ordinary relative paths", () => {
    expect(isPathSafe("HEARTRATE_AUTO.csv")).toBe(true);
    expect(isPathSafe("exports/SLEEP.csv")).toBe(true);
  });

  it("identifies .zip files by extension", () => {
    expect(isZipFile("export.zip")).toBe(true);
    expect(isZipFile("export.ZIP")).toBe(true);
    expect(isZipFile("export.csv")).toBe(false);
  });
});
