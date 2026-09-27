import { describe, it, expect } from "vitest";
import { classifySafety } from "@/lib/coach/safety.service";

describe("coach safety classification", () => {
  it("classifies a fully generic question (no personal pronoun) as general wellness", () => {
    expect(classifySafety("What is HRV?").classification).toBe("GENERAL_WELLNESS");
  });

  it("classifies questions referencing the user's own data as personal-health-context, distinct from general", () => {
    expect(classifySafety("Why has my recovery been worse lately?").classification).toBe("PERSONAL_HEALTH_CONTEXT");
    expect(classifySafety("Explain my ApoB trend").classification).toBe("PERSONAL_HEALTH_CONTEXT");
    expect(classifySafety("What should I focus on this week?").classification).toBe("PERSONAL_HEALTH_CONTEXT");
  });

  it("flags medication dosage/stopping questions as MEDICAL_REVIEW_RECOMMENDED", () => {
    expect(classifySafety("should I stop taking my medication").classification).toBe("MEDICAL_REVIEW_RECOMMENDED");
    expect(classifySafety("Should I increase my dose of magnesium?").classification).toBe("MEDICAL_REVIEW_RECOMMENDED");
    expect(classifySafety("Is it safe to take ashwagandha with my medication?").classification).toBe("MEDICAL_REVIEW_RECOMMENDED");
  });

  it("flags diagnosis requests as MEDICAL_REVIEW_RECOMMENDED", () => {
    expect(classifySafety("Do I have diabetes based on this?").classification).toBe("MEDICAL_REVIEW_RECOMMENDED");
  });

  it("flags urgent-symptom patterns as URGENT_MEDICAL_ATTENTION", () => {
    expect(classifySafety("I have severe chest pain and can't breathe").classification).toBe("URGENT_MEDICAL_ATTENTION");
    expect(classifySafety("I fell and now have numbness in my left arm").classification).toBe("URGENT_MEDICAL_ATTENTION");
  });

  it("provides a fixed, non-empty message for higher-risk classifications", () => {
    const urgent = classifySafety("chest pain right now");
    const medical = classifySafety("should I stop my prescription");
    expect(urgent.message).toBeTruthy();
    expect(medical.message).toBeTruthy();
    expect(urgent.message).not.toBe(medical.message);
  });

  it("never classifies an urgent symptom as merely general wellness", () => {
    const result = classifySafety("sudden numbness on one side of my body");
    expect(result.classification).not.toBe("GENERAL_WELLNESS");
    expect(result.classification).toBe("URGENT_MEDICAL_ATTENTION");
  });
});
