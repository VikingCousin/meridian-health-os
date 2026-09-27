"use client";

import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { SourceBadge } from "@/components/health/source-badge";
import { cn } from "@/lib/utils";
import { timelineFilters } from "@/lib/mock-data/timeline";
import { HealthEvent, TimelineEventType } from "@/types/health";
import { format, parseISO } from "date-fns";
import {
  FlaskConical,
  Watch,
  Dumbbell,
  Scale,
  Pill,
  Thermometer,
  NotebookPen,
  Target,
  type LucideIcon,
} from "lucide-react";

const typeIcon: Record<TimelineEventType, LucideIcon> = {
  lab: FlaskConical,
  wearable: Watch,
  training: Dumbbell,
  weight: Scale,
  supplement: Pill,
  illness: Thermometer,
  journal: NotebookPen,
  experiment: FlaskConical,
  goal: Target,
};

const typeColor: Record<TimelineEventType, string> = {
  lab: "var(--accent)",
  wearable: "var(--info)",
  training: "var(--sys-musculoskeletal)",
  weight: "var(--sys-metabolic)",
  supplement: "var(--gold)",
  illness: "var(--danger)",
  journal: "var(--sys-brain)",
  experiment: "var(--gold)",
  goal: "var(--accent)",
};

export function TimelineClient({ events }: { events: HealthEvent[] }) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const toggleFilter = (filter: string) => {
    setActiveFilters((prev) =>
      prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter]
    );
  };

  const filteredEvents = useMemo(() => {
    if (activeFilters.length === 0) return events;
    return events.filter((e) => e.tags?.some((t) => activeFilters.includes(t)));
  }, [activeFilters, events]);

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow="History"
        title="Timeline"
        description="Every measurement, session, and observation, woven into one longitudinal story."
      />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:px-0">
        {timelineFilters.map((filter) => {
          const active = activeFilters.includes(filter);
          return (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border-soft bg-surface text-muted-foreground hover:bg-surface-muted"
              )}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing here yet — labs, journal entries, goals, and experiments will show up here as you add them.
        </div>
      ) : (
        <div className="relative flex flex-col gap-6 pl-2">
          <div className="absolute bottom-4 left-[19px] top-2 w-px bg-border-soft" />
          {filteredEvents.map((event) => {
            const Icon = typeIcon[event.type];
            const color = typeColor[event.type];
            return (
              <div key={event.id} className="relative flex gap-4 pl-0">
                <div
                  className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 bg-surface"
                  style={{ borderColor: color, color }}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="flex-1 rounded-2xl border border-border-soft bg-surface p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {format(parseISO(event.date), "MMMM d, yyyy")}
                    </p>
                    <SourceBadge source={event.source} />
                  </div>
                  <h3 className="mt-1.5 font-medium">{event.title}</h3>
                  {event.detail && <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>}
                  {event.metrics && (
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                      {event.metrics.map((m) => (
                        <div key={m.label} className="text-sm">
                          <span className="text-muted-foreground">{m.label}: </span>
                          <span className="font-medium">{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {event.tags && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {event.tags.map((t) => (
                        <Badge key={t} variant="outline">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredEvents.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No events match these filters.</p>
          )}
        </div>
      )}
    </PageContainer>
  );
}
