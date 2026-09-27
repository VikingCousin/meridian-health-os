import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export function SystemTabs({
  biomarkers,
  trend,
  relationships,
  knowledge,
}: {
  biomarkers: React.ReactNode;
  trend: React.ReactNode;
  relationships: React.ReactNode;
  knowledge: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="biomarkers">
      <TabsList>
        <TabsTrigger value="biomarkers">Biomarkers</TabsTrigger>
        <TabsTrigger value="trend">Trend</TabsTrigger>
        <TabsTrigger value="relationships">Relationships</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge</TabsTrigger>
      </TabsList>
      <TabsContent value="biomarkers" className="flex flex-col gap-5">
        {biomarkers}
      </TabsContent>
      <TabsContent value="trend" className="flex flex-col gap-5">
        {trend}
      </TabsContent>
      <TabsContent value="relationships" className="flex flex-col gap-5">
        {relationships}
      </TabsContent>
      <TabsContent value="knowledge" className="flex flex-col gap-5">
        {knowledge}
      </TabsContent>
    </Tabs>
  );
}
