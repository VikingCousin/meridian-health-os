import { listJournalEntries } from "@/lib/services/journal.service";
import { JournalClient } from "@/components/journal/journal-client";

export default async function JournalPage() {
  const entries = await listJournalEntries();
  return <JournalClient initialEntries={entries} />;
}
