"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems } from "./nav-items";
import { useTranslations } from "@/lib/i18n/locale-provider";
import { cn } from "@/lib/utils";

export function Sidebar({
  profileName,
  avatarInitial,
  focus,
}: {
  profileName: string;
  avatarInitial: string;
  focus: string;
}) {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border-soft md:bg-surface md:px-3 md:py-5 lg:w-64">
      <div className="flex items-center gap-2.5 px-2 pb-7">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent-soft">
          <span className="font-mono text-sm font-bold text-accent">M</span>
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-[15px] font-semibold tracking-tight text-foreground">Meridian</span>
          <span className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-state-good shadow-[0_0_6px_var(--state-good)]" />
            {t("nav.systemOnline")}
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground",
                active && "bg-surface-elevated text-foreground"
              )}
            >
              <span
                className={cn(
                  "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-accent transition-opacity",
                  active ? "opacity-100" : "opacity-0"
                )}
              />
              <Icon
                className={cn("h-[18px] w-[18px] transition-colors", active ? "text-accent" : "text-muted-foreground group-hover:text-foreground")}
                strokeWidth={1.75}
              />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/profile"
        className="flex items-center gap-3 rounded-lg border border-border-soft bg-surface-elevated/60 px-3 py-2.5 hover:bg-surface-elevated"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-system-brain-soft font-mono text-sm font-medium text-system-brain">
          {avatarInitial}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium text-foreground">{profileName}</span>
          <span className="truncate text-[11px] text-muted-foreground">Focus: {focus}</span>
        </div>
      </Link>
    </aside>
  );
}
