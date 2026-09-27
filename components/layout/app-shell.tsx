import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { DemoModeBanner } from "./demo-mode-banner";
import { getOrCreateProfile } from "@/lib/services/profile.service";
import { listGoals } from "@/lib/services/goal.service";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const [profile, goals] = await Promise.all([getOrCreateProfile(), listGoals()]);
  const initial = profile.firstName.charAt(0).toUpperCase();
  const focus = goals.find((g) => g.kind === "long_term")?.title ?? "Personal health";

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar profileName={profile.firstName} avatarInitial={initial} focus={focus} />
      <div className="flex min-w-0 flex-1 flex-col pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <DemoModeBanner profileName={profile.firstName} />
        <main className="flex-1 pb-24 md:pb-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
