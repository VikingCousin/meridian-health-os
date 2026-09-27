import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { GoalCard } from "@/components/health/goal-card";
import { NewGoalDialog } from "@/components/health/new-goal-dialog";
import { listGoals } from "@/lib/services/goal.service";
import { getCurrentFocus } from "@/lib/services/coach-priority.service";

export default async function GoalsPage() {
  const [goals, focus] = await Promise.all([listGoals(), getCurrentFocus(10)]);
  const longTerm = goals.filter((g) => g.kind === "long_term");
  const supporting = goals.filter((g) => g.kind === "supporting");
  const projects = goals.filter((g) => g.kind === "project");
  const focusForGoal = (goalId: string) => focus.filter((f) => f.linkedGoalIds.includes(goalId));

  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader
        eyebrow="Direction"
        title="Goals"
        description="What you're optimizing for, and the temporary projects influencing it right now."
        action={<NewGoalDialog />}
      />

      {goals.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No goals yet — create one to get started.
        </div>
      )}

      {longTerm.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Long-term goal</h2>
          <div className="grid grid-cols-1 gap-4">
            {longTerm.map((g) => (
              <GoalCard key={g.id} goal={g} focusItems={focusForGoal(g.id)} />
            ))}
          </div>
        </section>
      )}

      {supporting.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Supporting goals</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {supporting.map((g) => (
              <GoalCard key={g.id} goal={g} focusItems={focusForGoal(g.id)} />
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold tracking-tight text-foreground">Current projects</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {projects.map((g) => (
              <GoalCard key={g.id} goal={g} focusItems={focusForGoal(g.id)} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
