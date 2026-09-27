"use client";

import Link from "next/link";
import { Biomarker } from "@/types/health";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline, TrendChart } from "@/components/charts/trend-chart";
import { TrendBadge } from "@/components/health/trend-badge";
import { SourceBadge } from "@/components/health/source-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { getSystemColorVar } from "@/lib/colors";

const completenessLabel = {
  complete: null,
  partial: "Partial data",
  sparse: "Limited data",
} as const;

export function BiomarkerCard({ biomarker }: { biomarker: Biomarker }) {
  const color = getSystemColorVar(biomarker.category);
  const target = biomarker.ranges.find((r) => r.kind === "personal_target");
  const reference = biomarker.ranges.find((r) => r.kind === "lab_reference");

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{biomarker.name}</h4>
              {completenessLabel[biomarker.dataCompleteness] && (
                <Badge variant="outline">{completenessLabel[biomarker.dataCompleteness]}</Badge>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Last measured {format(parseISO(biomarker.lastMeasured), "d MMM yyyy")}
            </p>
          </div>
          <SourceBadge source={biomarker.source} />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-medium tracking-tight tabular-nums">
              {biomarker.currentValue}
            </span>
            <span className="text-sm text-muted-foreground">{biomarker.unit}</span>
            {biomarker.changePct !== undefined && (
              <TrendBadge
                direction={biomarker.trendDirection}
                changePct={biomarker.changePct}
                className="ml-1"
              />
            )}
          </div>
          {biomarker.previousValue !== undefined && (
            <div className="text-right text-xs text-muted-foreground">
              Previous
              <div className="text-sm font-medium text-foreground">
                {biomarker.previousValue} {biomarker.unit}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {target && (
            <span>
              <span className="text-gold">●</span> Personal target: {target.display}
            </span>
          )}
          {reference && <span>Lab reference: {reference.display}</span>}
        </div>

        {biomarker.history.length > 1 && (
          <TrendChart data={biomarker.history} unit={biomarker.unit} color={color} ranges={biomarker.ranges} height={140} />
        )}

        <div className="flex flex-wrap gap-2 border-t border-border-soft pt-3">
          <Button asChild variant="subtle" size="sm">
            <Link href={`/profile/biomarker/${biomarker.id}`}>What is {biomarker.shortName}?</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/coach?q=${encodeURIComponent(`Explain my ${biomarker.shortName} trend`)}`}>
              Discuss with Coach
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function BiomarkerRow({ biomarker }: { biomarker: Biomarker }) {
  const color = getSystemColorVar(biomarker.category);
  return (
    <Link
      href={`/profile/biomarker/${biomarker.id}`}
      className="flex items-center justify-between gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-surface-muted"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{biomarker.name}</p>
        <p className="text-xs text-muted-foreground">
          {biomarker.currentValue} {biomarker.unit}
          {biomarker.changePct !== undefined && (
            <>
              {" "}
              · <TrendBadge
                direction={biomarker.trendDirection}
                changePct={biomarker.changePct}
                className="inline-flex"
              />
            </>
          )}
        </p>
      </div>
      {biomarker.history.length > 1 && (
        <div className="w-20 shrink-0">
          <Sparkline data={biomarker.history} color={color} height={32} />
        </div>
      )}
    </Link>
  );
}
