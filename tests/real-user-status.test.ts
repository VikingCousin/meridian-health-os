import { describe, it, expect } from "vitest";
import { NEUTRAL_PROFILE_FIRST_NAME } from "@/lib/services/profile.service";

describe("real-user profile fallback (Section 3)", () => {
  it("the auto-created fallback profile is never named after the demo persona", () => {
    expect(NEUTRAL_PROFILE_FIRST_NAME).not.toBe("Alex");
    expect(NEUTRAL_PROFILE_FIRST_NAME.toLowerCase()).not.toContain("alex");
  });
});
