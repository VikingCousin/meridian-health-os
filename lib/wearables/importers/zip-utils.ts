import JSZip from "jszip";
import path from "node:path";
import type { WearableInputFile } from "@/lib/wearables/types";

// Wearable export archives are untrusted input. Every safeguard here exists
// because of that — see docs/WEARABLE_ARCHITECTURE.md, "Security."

/** Hard caps — a real export is at most a few thousand small CSV/JSON rows; anything past this is either corrupt or hostile. */
const MAX_ENTRIES = 500;
const MAX_TOTAL_UNCOMPRESSED_BYTES = 200 * 1024 * 1024; // 200MB
const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = new Set([".csv", ".json", ".txt"]);

export class ZipSecurityError extends Error {}

/**
 * True if `entryPath` would stay strictly inside the extraction target once
 * resolved — the zip-slip check. Exported so it can be unit-tested directly
 * against hostile path strings without having to defeat JSZip's own
 * path-sanitizing `.file()` API just to construct a test fixture.
 */
export function isPathSafe(entryPath: string): boolean {
  if (path.isAbsolute(entryPath)) return false;
  const normalized = path.normalize(entryPath);
  if (normalized.startsWith("..") || normalized.includes(`..${path.sep}`)) return false;
  return true;
}

/**
 * Extracts only the supported, safely-pathed files from a zip archive,
 * entirely in memory (no files are ever written to disk during extraction —
 * there is nothing to "delete temporary files" afterward because nothing
 * temporary is created). Rejects the whole archive if it looks abusive
 * (too many entries, absolute/traversal paths, oversized content) rather
 * than silently skipping the bad parts.
 */
export async function extractSupportedFiles(zipBytes: Uint8Array): Promise<WearableInputFile[]> {
  const zip = await JSZip.loadAsync(zipBytes);
  const entries = Object.values(zip.files).filter((f) => !f.dir);

  if (entries.length > MAX_ENTRIES) {
    throw new ZipSecurityError(`Archive contains ${entries.length} entries, more than the ${MAX_ENTRIES} allowed for a wearable export.`);
  }

  const files: WearableInputFile[] = [];
  let totalBytes = 0;

  for (const entry of entries) {
    if (!isPathSafe(entry.name)) {
      throw new ZipSecurityError(`Archive entry "${entry.name}" has an unsafe path and was rejected.`);
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) continue; // silently skip unsupported file types (e.g. images, binaries) — not a security issue, just irrelevant

    const content = await entry.async("string");
    const byteLength = Buffer.byteLength(content, "utf8");
    if (byteLength > MAX_SINGLE_FILE_BYTES) {
      throw new ZipSecurityError(`Archive entry "${entry.name}" (${byteLength} bytes) exceeds the per-file size limit.`);
    }
    totalBytes += byteLength;
    if (totalBytes > MAX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new ZipSecurityError("Archive's total uncompressed size exceeds the limit for a wearable export.");
    }

    files.push({ name: entry.name, content });
  }

  return files;
}

export function isZipFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".zip");
}
