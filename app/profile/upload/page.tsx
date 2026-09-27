import { LabUploadWizard } from "@/components/profile/lab-upload-wizard";
import { getAppSettings } from "@/lib/services/settings.service";
import { biomarkerRepo } from "@/lib/services/biomarker.service";

export default async function LabUploadPage() {
  const [settings, definitions] = await Promise.all([getAppSettings(), biomarkerRepo.listBiomarkerDefinitions()]);
  const biomarkerOptions = definitions.map((d) => ({
    id: d.id,
    displayName: d.displayName,
    category: d.category,
    defaultUnit: d.defaultUnit,
  }));

  return <LabUploadWizard demoMode={settings.demoMode} externalAiEnabled={settings.externalAiEnabled} biomarkerOptions={biomarkerOptions} />;
}
