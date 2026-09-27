"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { mobileNavItems } from "./nav-items";
import { MoreSheet } from "./more-sheet";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border-soft bg-surface/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-1 pb-[env(safe-area-inset-bottom)]">
        {mobileNavItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium"
            >
              <Icon
                className={cn("h-5 w-5", active ? "text-accent" : "text-muted-foreground")}
                strokeWidth={active ? 2 : 1.75}
              />
              <span className={cn(active ? "text-accent" : "text-muted-foreground")}>{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <MoreSheet />
      </div>
    </nav>
  );
}
