export interface ConnectedSource {
  id: string;
  name: string;
  type: "wearable" | "lab" | "manual" | "journal";
  status: "connected" | "manual" | "needs_sync";
  detail: string;
}

// The wearable entry lives here no longer — Amazfit/Zepp is now a real,
// DB-backed HealthDataSource (see lib/services/wearable-data-source.service.ts)
// shown on the Profile page and at /profile/data-sources, not mock data.
export const connectedSources: ConnectedSource[] = [
  { id: "quest", name: "Quest Diagnostics", type: "lab", status: "connected", detail: "Last import 21 Aug 2026" },
  { id: "viome", name: "Viome stool panel", type: "lab", status: "needs_sync", detail: "Last import 4 May 2026 — due for a refresh" },
  { id: "inbody", name: "InBody scan", type: "manual", status: "manual", detail: "Logged manually after each scan" },
  { id: "journal", name: "Journal", type: "journal", status: "connected", detail: "5 entries this month" },
];

export interface LabDocument {
  id: string;
  name: string;
  date: string;
  valuesDetected: number;
  status: "imported" | "needs_review";
}

export const labDocuments: LabDocument[] = [
  { id: "doc-1", name: "Quest Diagnostics — Full Panel", date: "2026-08-21", valuesDetected: 18, status: "imported" },
  { id: "doc-2", name: "Viome — Gut Intelligence Report", date: "2026-05-04", valuesDetected: 9, status: "imported" },
  { id: "doc-3", name: "Quest Diagnostics — Full Panel", date: "2026-01-18", valuesDetected: 16, status: "imported" },
];
