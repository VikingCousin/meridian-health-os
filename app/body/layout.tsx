import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { BodyExplorerShell } from "@/components/body/body-explorer-shell";
import { bodySystems } from "@/lib/mock-data/body-systems";

export default function BodyLayout({ children }: LayoutProps<"/body">) {
  return (
    <PageContainer className="animate-fade-in-up">
      <PageHeader eyebrow="Interactive · Integrated · Personal" title="Your body, as a system." />
      <BodyExplorerShell systems={bodySystems}>{children}</BodyExplorerShell>
    </PageContainer>
  );
}
