import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { ExperimentCard } from "@/components/health/experiment-card";
import { NewExperimentDialog } from "@/components/health/new-experiment-dialog";
import { listExperiments } from "@/lib/services/experiment.service";

export default async function ExperimentsPage() {
  const experiments = await listExperiments();

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow="Test"
        title="Experiments"
        description="Turn observations into testable personal hypotheses — with a clear baseline to compare against."
        action={<NewExperimentDialog />}
      />

      {experiments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No experiments yet — start one to test a personal hypothesis.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {experiments.map((e) => (
            <ExperimentCard key={e.id} experiment={e} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
