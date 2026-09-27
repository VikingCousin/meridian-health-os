"use client";

import { useState, useTransition } from "react";
import { DatabaseBackup, Download, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBackupAction, exportUserDataAction } from "@/lib/actions/data-management";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { format } from "date-fns";

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "unknown";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerDownload(base64: string, fileName: string) {
  const bytes = atob(base64);
  const array = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
  const blob = new Blob([array], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function DataManagementPanel({
  dbSizeBytes,
  lastBackupAt,
  uploadsSizeBytes,
}: {
  dbSizeBytes: number | null;
  lastBackupAt: string | null;
  uploadsSizeBytes: number;
}) {
  const [backupState, setBackupState] = useState<{ lastBackupAt: string | null; message: string | null; error: string | null }>({
    lastBackupAt,
    message: null,
    error: null,
  });
  const [exportError, setExportError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { t } = useTranslations();

  const runBackup = () => {
    setBackupState((s) => ({ ...s, message: null, error: null }));
    startTransition(async () => {
      const result = await createBackupAction();
      if (!result.ok) {
        setBackupState((s) => ({ ...s, error: result.error }));
        return;
      }
      setBackupState({ lastBackupAt: result.createdAt, message: `Saved ${result.fileName} (${formatBytes(result.sizeBytes)}).`, error: null });
    });
  };

  const runExport = () => {
    setExportError(null);
    startTransition(async () => {
      const result = await exportUserDataAction();
      if (!result.ok) {
        setExportError(result.error);
        return;
      }
      triggerDownload(result.base64, result.fileName);
    });
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("profile.dataManagement")}</h2>

      <div className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <DatabaseBackup className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("profile.localBackup")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Database: {formatBytes(dbSizeBytes)} · Uploads: {formatBytes(uploadsSizeBytes)} (not included in this backup) · Last backup:{" "}
              {backupState.lastBackupAt ? format(new Date(backupState.lastBackupAt), "d MMM yyyy, HH:mm") : "never"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Creates a timestamped copy of your database under data/backups/. To restore, stop the app and copy that file back over
              data/app.db — see docs/DATA_PORTABILITY.md.
            </p>
          </div>
          <Button onClick={runBackup} disabled={isPending} variant="outline" size="sm">
            {t("profile.createBackup")}
          </Button>
        </div>
        {backupState.message && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-accent">
            <CheckCircle2 className="h-3.5 w-3.5" /> {backupState.message}
          </p>
        )}
        {backupState.error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
            <XCircle className="h-3.5 w-3.5" /> {backupState.error}
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-border-soft bg-surface p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
            <Download className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t("profile.exportMyData")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("profile.exportMyDataDescription")}</p>
          </div>
          <Button onClick={runExport} disabled={isPending} size="sm">
            {t("profile.exportMyData")}
          </Button>
        </div>
        {exportError && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-danger">
            <XCircle className="h-3.5 w-3.5" /> {exportError}
          </p>
        )}
      </div>
    </section>
  );
}
