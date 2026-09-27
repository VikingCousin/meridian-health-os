"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { moreNavItem, moreSheetItems } from "./nav-items";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function MoreSheet() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useTranslations();
  const Icon = moreNavItem.icon;
  const isActive = moreSheetItems.some((item) => pathname.startsWith(item.href));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium">
          <Icon className={cn("h-5 w-5", isActive ? "text-accent" : "text-muted-foreground")} strokeWidth={isActive ? 2 : 1.75} />
          <span className={cn(isActive ? "text-accent" : "text-muted-foreground")}>{t(moreNavItem.labelKey)}</span>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface-elevated p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] outline-none"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">{t("nav.more")}</DialogPrimitive.Title>
          <div className="mx-auto mb-2 mt-1 h-1 w-9 rounded-full bg-border" />
          <div className="flex flex-col gap-1 p-2">
            {moreSheetItems.map((item) => {
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3.5 rounded-xl px-3 py-3 active:bg-surface-active"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-surface text-accent">
                    <ItemIcon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{t(item.labelKey)}</p>
                    <p className="truncate text-xs text-muted-foreground">{t(item.descriptionKey)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                </Link>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
