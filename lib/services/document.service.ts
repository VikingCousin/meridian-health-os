import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import * as documentRepo from "@/lib/db/repositories/document.repository";
import type { DocumentType } from "@/lib/generated/prisma/client";

const EXTENSION_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
};

export function getUploadsDir(): string {
  const configured = process.env.HEALTH_UPLOADS_DIR ?? "./data/uploads";
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

/** Writes an uploaded file to local disk under HEALTH_UPLOADS_DIR and returns its path relative to that directory. */
async function storeFileOnDisk(bytes: Uint8Array, mimeType: string): Promise<string> {
  const dir = getUploadsDir();
  await mkdir(dir, { recursive: true });
  const extension = EXTENSION_BY_MIME[mimeType] ?? "";
  const fileName = `${randomUUID()}${extension}`;
  await writeFile(path.join(dir, fileName), bytes);
  return fileName;
}

export interface UploadHealthDocumentInput {
  file: File;
  type: DocumentType;
  providerName?: string;
  documentDate?: Date;
  notes?: string;
}

export async function uploadHealthDocument(input: UploadHealthDocumentInput) {
  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const localFilePath = await storeFileOnDisk(bytes, input.file.type);

  return documentRepo.createDocument({
    type: input.type,
    originalFileName: input.file.name,
    mimeType: input.file.type,
    localFilePath,
    fileSizeBytes: input.file.size,
    documentDate: input.documentDate,
    providerName: input.providerName,
    notes: input.notes,
  });
}

export async function listDocuments() {
  return documentRepo.listDocuments();
}

export function getDocumentAbsolutePath(localFilePath: string): string {
  return path.join(getUploadsDir(), localFilePath);
}
