import Link from "next/link";
import { Circle, CircleCheck } from "lucide-react";
import type { RealUserDataStatus } from "@/lib/services/real-user-status.service";
import { getTranslations } from "@/lib/i18n/server";

const ITEMS: { key: keyof RealUserDataStatus; labelKey: string; href: string }[] = [
  { key: "hasProfile", labelKey: "firstDataChecklist.completeProfile", href: "/profile" },
  { key: "hasGoal", labelKey: "firstDataChecklist.addFirstGoal", href: "/goals" },
  { key: "hasJournalEntry", labelKey: "firstDataChecklist.addJournalEntry", href: "/journal" },
  { key: "hasLabData", labelKey: "firstDataChecklist.uploadLab", href: "/profile/upload" },
  { key: "hasWearableData", labelKey: "firstDataChecklist.importWearable", href: "/profile/data-sources" },
];

/**
 * Section 14 of the V1 hardening spec: a compact, dismissible-by-nature
 * checklist (it disappears item-by-item as each thing is done, never a
 * blocking wizard) shown only when a real-user dataset is genuinely empty.
 */
export async function FirstDataChecklist({ status }: { status: RealUserDataStatus }) {
  const { t } = await getTranslations();

  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface-muted/40 p-5">
      <h2 className="text-sm font-medium text-foreground">{t("firstDataChecklist.title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("firstDataChecklist.description")}</p>
      <div className="mt-3 flex flex-col gap-1.5">
        {ITEMS.map((item) => {
          const done = status[item.key];
          return (
            <Link
              key={item.key}
              href={item.href}
              className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-surface-elevated"
            >
              {done ? (
                <CircleCheck className="h-4 w-4 shrink-0 text-accent" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
              )}
              <span className={done ? "text-muted-foreground line-through" : "text-foreground"}>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
