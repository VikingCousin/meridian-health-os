import { redirect } from "next/navigation";

// The Body explorer always has a selected system — the rail and anatomy are
// shared chrome (see layout.tsx), so /body itself just resolves to a
// sensible default rather than needing its own empty/prompt state.
export default function BodyIndexPage() {
  redirect("/body/cardiovascular");
}
