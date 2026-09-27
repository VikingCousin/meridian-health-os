import Link from "next/link";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EditProfileDialog } from "@/components/profile/edit-profile-dialog";
import { AddMedicalHistoryDialog } from "@/components/profile/add-medical-history-dialog";
import { AddMedicationDialog } from "@/components/profile/add-medication-dialog";
import { getProfileBundle } from "@/lib/services/profile.service";
import { listDocuments } from "@/lib/services/document.service";
import { listGoals } from "@/lib/services/goal.service";
import { listExperiments } from "@/lib/services/experiment.service";
import { getAmazfitSummary } from "@/lib/services/wearable-data-source.service";
import { getBackupStatus } from "@/lib/services/data-management.service";
import { getAppSettings } from "@/lib/services/settings.service";
import { DataManagementPanel } from "@/components/profile/data-management-panel";
import { PrivacyAiPanel } from "@/components/profile/privacy-ai-panel";
import { LanguageSelector } from "@/components/profile/language-selector";
import { getTranslations } from "@/lib/i18n/server";
import { differenceInYears, format } from "date-fns";
import { Watch, UploadCloud, ChevronRight, FileText, Target, FlaskConicalIcon, Pill, Leaf, HeartPulse } from "lucide-react";

const wearableStatusMeta: Record<string, { label: string; variant: "accent" | "neutral" | "warn" | "danger" }> = {
  NOT_CONFIGURED: { label: "Not configured", variant: "neutral" },
  CONNECTED: { label: "Imported", variant: "accent" },
  NEEDS_IMPORT: { label: "Needs new import", variant: "warn" },
  ERROR: { label: "Error", variant: "danger" },
};

const historyStatusVariant: Record<string, "accent" | "warn" | "info" | "neutral"> = {
  ACTIVE: "warn",
  MANAGED: "info",
  RESOLVED: "accent",
  SUSPECTED: "neutral",
  HISTORICAL: "neutral",
};

export default async function ProfilePage() {
  const [{ profile, medicalHistory, medications, supplements }, documents, goals, experiments, wearableSummary, backupStatus, appSettings, { t, locale }] =
    await Promise.all([
      getProfileBundle(),
      listDocuments(),
      listGoals(),
      listExperiments(),
      getAmazfitSummary(),
      getBackupStatus(),
      getAppSettings(),
      getTranslations(),
    ]);
  const wearableStatus = wearableStatusMeta[wearableSummary.dataSource.status];

  const age = differenceInYears(new Date(), profile.dateOfBirth);
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader eyebrow="You" title={t("profile.title")} description={t("profile.description")} />

      {/* Personal */}
      <section className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sys-brain-soft text-xl font-medium text-sys-brain">
            {profile.firstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-medium">{fullName}</h2>
            <p className="text-sm text-muted-foreground">
              {age} yrs · {profile.heightCm} cm{profile.currentWeightKg ? ` · ${profile.currentWeightKg} kg` : ""}
            </p>
            <p className="text-xs text-muted-foreground">{t("profile.memberSince", { date: format(profile.createdAt, "MMMM yyyy") })}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <EditProfileDialog profile={profile} />
          <Button asChild variant="outline" size="sm">
            <Link href="/goals">
              <Target className="h-4 w-4" /> {t("nav.goals")}
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/experiments">
              <FlaskConicalIcon className="h-4 w-4" /> {t("nav.experiments")}
            </Link>
          </Button>
        </div>
      </section>

      {/* Lab upload CTA */}
      <section className="flex flex-col items-start gap-4 rounded-2xl border border-dashed border-border bg-surface-muted/40 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
            <UploadCloud className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-medium">{t("profile.addLabReport")}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("profile.addLabReportDescription")}</p>
          </div>
        </div>
        <Button asChild>
          <Link href="/profile/upload">{t("profile.uploadDocument")}</Link>
        </Button>
      </section>

      {/* Medical history */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("profile.medicalHistory")}</h2>
          <AddMedicalHistoryDialog />
        </div>
        {medicalHistory.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("profile.noConditionsLogged")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {medicalHistory.map((h) => (
              <div key={h.id} className="flex items-center gap-3.5 rounded-xl border border-border-soft bg-surface p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <HeartPulse className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{h.condition}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.diagnosisDate ? format(h.diagnosisDate, "d MMM yyyy") + " · " : ""}
                    {h.source.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
                <Badge variant={historyStatusVariant[h.status]}>{h.status.charAt(0) + h.status.slice(1).toLowerCase()}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Medication */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("profile.medication")}</h2>
          <AddMedicationDialog kind="medication" />
        </div>
        {medications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("profile.noMedicationsLogged")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {medications.map((m) => (
              <div key={m.id} className="flex items-center gap-3.5 rounded-xl border border-border-soft bg-surface p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <Pill className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[m.dose && `${m.dose}${m.unit ?? ""}`, m.frequency].filter(Boolean).join(" · ") || "No dosage set"}
                  </p>
                </div>
                <Badge variant={m.active ? "accent" : "neutral"}>{m.active ? "Active" : "Stopped"}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Supplements */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{t("profile.supplements")}</h2>
          <AddMedicationDialog kind="supplement" />
        </div>
        {supplements.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("profile.noSupplementsLogged")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {supplements.map((s) => (
              <div key={s.id} className="flex items-center gap-3.5 rounded-xl border border-border-soft bg-surface p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
                  <Leaf className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {[s.dose && `${s.dose}${s.unit ?? ""}`, s.frequency].filter(Boolean).join(" · ") || "No dosage set"}
                  </p>
                </div>
                <Badge variant={s.active ? "accent" : "neutral"}>{s.active ? "Active" : "Stopped"}</Badge>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Data sources */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">{t("profile.dataSources")}</h2>
        <div className="flex flex-col gap-2.5">
          <Link
            href="/profile/data-sources"
            className="flex items-center gap-3.5 rounded-xl border border-border-soft bg-surface p-4 transition-colors hover:bg-surface-elevated"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted-foreground">
              <Watch className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{wearableSummary.dataSource.displayName}</p>
              <p className="text-xs text-muted-foreground">
                {wearableSummary.dataSource.lastImportAt ? `Last import ${format(wearableSummary.dataSource.lastImportAt, "d MMM yyyy")}` : "No import yet"}
              </p>
            </div>
            <Badge variant={wearableStatus.variant}>{wearableStatus.label}</Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </Link>
          <p className="px-1 text-xs text-muted-foreground">{t("profile.labReportsNote")}</p>
        </div>
      </section>

      {/* Documents */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">{t("profile.documents")}</h2>
        {documents.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("profile.noDocumentsUploaded")}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3.5 rounded-xl border border-border-soft bg-surface p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
                  <FileText className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{doc.providerName ?? doc.originalFileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.documentDate ? format(doc.documentDate, "d MMM yyyy") : format(doc.createdAt, "d MMM yyyy")} · {doc.type.replaceAll("_", " ").toLowerCase()}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Goals & experiments preview */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-border-soft bg-surface p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">{t("nav.goals")}</h3>
            <Link href="/goals" className="text-xs font-medium text-accent hover:underline">
              {t("profile.viewAll")}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("profile.goalsCount", {
              count: goals.length,
              focus: goals.find((g) => g.kind === "long_term")?.title ?? t("profile.yourLongTermFocus"),
            })}
          </p>
        </div>
        <div className="rounded-2xl border border-border-soft bg-surface p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-medium">{t("nav.experiments")}</h3>
            <Link href="/experiments" className="text-xs font-medium text-accent hover:underline">
              {t("profile.viewAll")}
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("profile.activeExperiments", { active: experiments.filter((e) => e.status === "active").length, total: experiments.length })}
          </p>
        </div>
      </section>

      <DataManagementPanel
        dbSizeBytes={backupStatus.dbSizeBytes}
        lastBackupAt={backupStatus.lastBackupAt?.toISOString() ?? null}
        uploadsSizeBytes={backupStatus.uploadsSizeBytes}
      />

      <PrivacyAiPanel initialExternalAiEnabled={appSettings.externalAiEnabled} initialDemoMode={appSettings.demoMode} />

      <LanguageSelector initialLocale={locale} />
    </PageContainer>
  );
}
