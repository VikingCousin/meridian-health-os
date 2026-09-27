import { buildTimeline } from "@/lib/services/timeline.service";
import { TimelineClient } from "@/components/health/timeline-client";

export default async function TimelinePage() {
  const events = await buildTimeline();
  return <TimelineClient events={events} />;
}
