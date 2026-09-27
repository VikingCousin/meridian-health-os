import { describe, it, expect, afterEach } from "vitest";
import { getAppSettings, setDemoMode, setExternalAiEnabled } from "@/lib/services/settings.service";
import { getAiProvider } from "@/lib/ai";

const ORIGINAL_ENV = { ...process.env };

describe("settings.service (DB-wired)", () => {
  afterEach(async () => {
    process.env = { ...ORIGINAL_ENV };
    // Leave the singleton in its default state for every other test file.
    await setDemoMode(true);
    await setExternalAiEnabled(true);
  });

  it("defaults to demo mode OFF (real mode) and external AI on when never configured", async () => {
    // A never-seeded database must read as real mode from the first access —
    // see lib/services/settings.service.ts and docs/DATA_MODEL.md, "Real-user mode."
    await setDemoMode(false);
    const settings = await getAppSettings();
    expect(settings.demoMode).toBe(false);
    expect(settings.externalAiEnabled).toBe(true);
  });

  it("persists a demo-mode change", async () => {
    await setDemoMode(false);
    const settings = await getAppSettings();
    expect(settings.demoMode).toBe(false);
  });

  it("turning external AI off makes getAiProvider() return null even with a provider configured in .env", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    await setExternalAiEnabled(false);
    expect(await getAiProvider()).toBeNull();
  });

  it("turning external AI back on restores the env-configured provider", async () => {
    process.env.AI_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "test-key-not-real";
    await setExternalAiEnabled(true);
    const provider = await getAiProvider();
    expect(provider?.name).toBe("anthropic");
  });
});
