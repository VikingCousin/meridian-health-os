import { notFound } from "next/navigation";
import { getBodySystem } from "@/lib/mock-data/body-systems";
import { CardiovascularDetail } from "@/components/body/cardiovascular-detail";
import { GutDetail } from "@/components/body/gut-detail";
import { BrainDetail } from "@/components/body/brain-detail";
import { MusculoskeletalDetail } from "@/components/body/musculoskeletal-detail";
import { LiverDetail } from "@/components/body/liver-detail";
import { ImmuneDetail } from "@/components/body/immune-detail";
import { GenericSystemDetail } from "@/components/body/generic-system-detail";
import { RelevantInsights } from "@/components/body/relevant-insights";
import { CurrentFocusForSystem } from "@/components/body/current-focus-for-system";

function renderDetail(system: NonNullable<ReturnType<typeof getBodySystem>>) {
  switch (system.id) {
    case "cardiovascular":
      return <CardiovascularDetail system={system} />;
    case "gut":
      return <GutDetail system={system} />;
    case "brain":
      return <BrainDetail system={system} />;
    case "musculoskeletal":
      return <MusculoskeletalDetail system={system} />;
    case "liver":
      return <LiverDetail system={system} />;
    case "immune":
      return <ImmuneDetail system={system} />;
    default:
      return <GenericSystemDetail system={system} />;
  }
}

export default async function SystemDetailPage(props: PageProps<"/body/[system]">) {
  const { system: systemId } = await props.params;
  const system = getBodySystem(systemId);

  if (!system || !system.hasDetailPage) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-5">
      {renderDetail(system)}
      <CurrentFocusForSystem system={system.id} />
      <RelevantInsights system={system.id} />
    </div>
  );
}
